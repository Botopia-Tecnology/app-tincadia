const { withAppDelegate } = require('expo/config-plugins');

/**
 * Expo Config Plugin for iOS VoIP PushKit + CallKit integration.
 *
 * Critical iOS rule (assert en PKPushRegistry.m): cada push VoIP debe reportar
 * una llamada a CallKit en el MISMO run loop de didReceiveIncomingPushWithPayload,
 * sin trabajo previo. Si el reporte no ocurre o CallKit lo rechaza (p. ej. UUID
 * duplicado), iOS mata el proceso con NSInternalInconsistencyException — un kill
 * del sistema que Sentry no puede capturar.
 *
 * Por eso el handler: (1) reporta PRIMERO usando solo datos del payload,
 * (2) para pushes terminales (call_ended/missed/rejected), que llegan con el
 * mismo UUID que el ringing, reporta una llamada efímera con UUID nuevo y la
 * termina de inmediato junto con la original, y (3) solo DESPUÉS entrega el
 * payload al bridge de React Native.
 */
module.exports = function withVoipAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;
    const language = config.modResults.language;

    if (language === 'swift') {
      // Replace any previously injected PushKit delegate block from older versions
      // of this plugin. Otherwise prebuilds that reuse ios/ keep the broken handler.
      contents = contents.replace(
        /\n#if canImport\(PushKit\)\nimport PushKit[\s\S]*?extension AppDelegate: PKPushRegistryDelegate[\s\S]*?\n\}\n#endif\n?/m,
        '\n'
      );

      // ── COLD-START REGISTRO NATIVO DEL PKPushRegistry ──
      // Sin esto, el registry solo se crea desde JS (registerVoipToken), que no
      // corre con la app terminada: iOS no tiene delegate al que entregar el push
      // VoIP en frío, así que la llamada solo entra con la app abierta. Registrar
      // el registry en didFinishLaunching hace que iOS despierte la app cerrada.
      // Idempotente con el registro JS (mismo delegate, mismo token).
      // Quita cualquier llamada de registro inyectada por una pasada anterior
      // (prebuilds que reusan ios/), para no duplicarla al reinsertar.
      contents = contents.replace(
        /\n[ \t]*TincadiaVoipRegistry\.shared\.register\(delegate: self\)/g,
        ''
      );

      // Inserta el registro ANTES del `return super.application(...)` de la
      // plantilla de Expo (SDK 54): esa línea retorna, así que insertar después
      // sería código muerto. Si la firma cambiara, el replace no aplica y se
      // registra un aviso en el build, pero nunca rompe la compilación.
      const didFinishReturnRegex =
        /(\n[ \t]*)(return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\))/;
      if (didFinishReturnRegex.test(contents)) {
        contents = contents.replace(
          didFinishReturnRegex,
          `$1TincadiaVoipRegistry.shared.register(delegate: self)$1$2`
        );
      } else {
        console.warn(
          '[withVoipAppDelegate] No se encontró el return super.application(didFinishLaunchingWithOptions) esperado; ' +
          'el registro nativo de PushKit en cold-start NO se inyectó. Revisa la plantilla del AppDelegate de este SDK.'
        );
      }

      const swiftExtension = `
#if canImport(PushKit)
import PushKit
import CallKit
#if canImport(RNCallKeep)
import RNCallKeep
#endif

// Retiene el PKPushRegistry a nivel de proceso: si se libera, iOS deja de
// entregar pushes VoIP. Registra el delegate en el arranque nativo (cold start).
final class TincadiaVoipRegistry {
    static let shared = TincadiaVoipRegistry()
    private var registry: PKPushRegistry?

    func register(delegate: PKPushRegistryDelegate) {
        if registry != nil { return }
        let reg = PKPushRegistry(queue: .main)
        reg.delegate = delegate
        reg.desiredPushTypes = [.voIP]
        registry = reg
    }
}

// Último recurso si RNCallKeep no es importable: PushKit exige reportar una
// llamada por CADA push VoIP o iOS mata el proceso (assert en PKPushRegistry.m).
// Reporta una llamada efímera vía CXProvider puro y la termina de inmediato.
final class TincadiaFallbackCallReporter {
    static let shared = TincadiaFallbackCallReporter()
    private lazy var provider: CXProvider = {
        let config = CXProviderConfiguration(localizedName: "Tincadia")
        config.supportsVideo = true
        return CXProvider(configuration: config)
    }()

    func reportAndEnd(uuid: UUID, handle: String, completion: @escaping () -> Void) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handle)
        provider.reportNewIncomingCall(with: uuid, update: update) { [self] _ in
            provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
            completion()
        }
    }
}

extension AppDelegate: PKPushRegistryDelegate {
    private func tincadiaEnsureCallKeepSetup() {
        #if canImport(RNCallKeep)
        // Método de clase de RNCallKeep: síncrono y sin bridge, seguro en cold start.
        RNCallKeep.setup([
            "appName": "Tincadia",
            "handleType": "generic",
            "supportsVideo": true,
            "includesCallsInRecents": true,
            "maximumCallGroups": 2,
            "maximumCallsPerCallGroup": 1
        ])
        #endif
    }

    // Una llamada con este UUID ya está registrada en CallKit (sonando o activa).
    // No usa RNCallKeep.isCallActive porque esa devuelve hasConnected y una
    // llamada sonando aún no conecta.
    private func tincadiaCallAlreadyReported(_ uuidString: String) -> Bool {
        guard let uuid = UUID(uuidString: uuidString) else { return false }
        return CXCallObserver().calls.contains { $0.uuid == uuid && !$0.hasEnded }
    }

    // @objc explícito: fija el selector ObjC exacto que PushKit busca con
    // respondsToSelector:. Un método en una extension NO recibe @objc inferido
    // salvo que calce EXACTO con el requirement del protocolo — si no calza,
    // queda como método Swift puro y PushKit jamás lo invoca.
    @objc(pushRegistry:didUpdatePushCredentials:forType:)
    public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        if let managerClass = NSClassFromString("RNVoipPushNotificationManager") as? NSObject.Type {
            let selector = NSSelectorFromString("didUpdatePushCredentials:forType:")
            if managerClass.responds(to: selector) {
                managerClass.perform(selector, with: pushCredentials, with: type.rawValue)
            }
        }
    }

    // BUG HISTÓRICO (crash "never posted an incoming call"): este método se
    // declaraba como didReceiveIncomingPushWithPayload — near-miss del
    // requirement Swift real (didReceiveIncomingPushWith payload:for:completion:).
    // Al no calzar, no recibía @objc inferido, PushKit no encontraba el selector
    // y mataba la app en cada push VoIP sin que NINGÚN código nuestro corriera.
    // El @objc explícito fija el selector aunque el nombre Swift varíe.
    @objc(pushRegistry:didReceiveIncomingPushWithPayload:forType:withCompletionHandler:)
    public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        // REGLA DE PUSHKIT: reportar una llamada a CallKit en ESTE run loop,
        // antes de cualquier otro trabajo. Hasta reportNewIncomingCall solo se
        // lee el diccionario del push — nada de bridge de React Native.
        var payloadDict = payload.dictionaryPayload
        let rawUUID = (payloadDict["callUUID"] as? String) ?? (payloadDict["uuid"] as? String) ?? UUID().uuidString
        let callUUID = UUID(uuidString: rawUUID)?.uuidString ?? UUID().uuidString
        let callerName = (payloadDict["callerName"] as? String) ?? (payloadDict["senderName"] as? String) ?? "Tincadia"
        let handle = (payloadDict["handle"] as? String) ?? (payloadDict["senderName"] as? String) ?? "Tincadia Call"
        let pushType = (payloadDict["type"] as? String) ?? ""
        let isTerminal = pushType == "call_ended" || pushType == "call_missed" || pushType == "call_rejected"

        // Los pushes terminales llegan con el MISMO UUID que el push de ringing
        // (backend: UUID estable por sesión). Reportar dos veces el mismo UUID
        // hace que CallKit rechace el reporte (CallUUIDAlreadyExists) y el push
        // quedaría sin llamada registrada: iOS mataría la app. En ese caso se
        // reporta una llamada efímera con UUID nuevo (cumple PushKit) y acto
        // seguido se termina, junto con la original si sigue sonando.
        let alreadyReported = tincadiaCallAlreadyReported(callUUID)
        let reportUUID = (isTerminal || alreadyReported) ? UUID().uuidString : callUUID
        payloadDict["nativeCallUUID"] = reportUUID
        payloadDict["callUUID"] = reportUUID
        payloadDict["originalCallUUID"] = rawUUID

        #if canImport(RNCallKeep)
        tincadiaEnsureCallKeepSetup()
        RNCallKeep.reportNewIncomingCall(
            reportUUID,
            handle: handle,
            handleType: "generic",
            hasVideo: true,
            localizedCallerName: callerName,
            supportsHolding: true,
            supportsDTMF: true,
            supportsGrouping: true,
            supportsUngrouping: true,
            fromPushKit: true,
            payload: payloadDict,
            withCompletionHandler: completion
        )

        if isTerminal || alreadyReported {
            // 3 = unanswered (aparece como perdida), 2 = remoteEnded. endCallWithUUID
            // usa reportCallWithUUID (un reporte al CXProvider, no una CXAction):
            // no dispara eventos JS, así que no hay side effects en el bundle.
            let endReason: Int32 = pushType == "call_missed" ? 3 : 2
            DispatchQueue.main.async {
                if isTerminal {
                    RNCallKeep.endCall(withUUID: callUUID, reason: endReason)
                }
                RNCallKeep.endCall(withUUID: reportUUID, reason: endReason)
            }
        }
        #else
        TincadiaFallbackCallReporter.shared.reportAndEnd(
            uuid: UUID(uuidString: reportUUID) ?? UUID(),
            handle: handle,
            completion: completion
        )
        #endif

        // La entrega del payload a JS va DESPUÉS del reporte. Con el bundle sin
        // cargar, RNVoipPushNotificationManager encola el evento y JS lo recibe
        // vía didLoadWithEvents.
        if let managerClass = NSClassFromString("RNVoipPushNotificationManager") as? NSObject.Type {
            let selector = NSSelectorFromString("didReceiveIncomingPushWithPayload:forType:")
            if managerClass.responds(to: selector) {
                managerClass.perform(selector, with: payload, with: type.rawValue)
            }
        }
    }
}
#endif
`;
      // Normaliza el final del archivo para que pasadas repetidas del plugin
      // (prebuilds que reusan ios/) no acumulen líneas en blanco.
      contents = contents.replace(/\n*$/, '\n') + swiftExtension;
    } else if (language === 'objc' || language === 'objcpp') {
      contents = contents.replace(
        /\n#import <PushKit\/PushKit\.h>\n#import "RNVoipPushNotificationManager\.h"[\s\S]*?- \(void\)pushRegistry:\(PKPushRegistry \*\)registry didReceiveIncomingPushWithPayload:\(PKPushPayload \*\)payload forType:\(PKPushType\)type withCompletionHandler:\(void \(\^\)\(void\)\)completion \{[\s\S]*?\n\}\n\n/m,
        '\n'
      );

      const lastEndIndex = contents.lastIndexOf('@end');
      if (lastEndIndex !== -1) {
        const objcImplementation = `
#import <PushKit/PushKit.h>
#import "RNVoipPushNotificationManager.h"
#import "RNCallKeep.h"
#import <CallKit/CallKit.h>

static NSString *TincadiaValidCallUUID(NSDictionary *payload) {
    id rawUUID = payload[@"callUUID"] ?: payload[@"uuid"];
    if ([rawUUID isKindOfClass:[NSString class]] && [[NSUUID alloc] initWithUUIDString:(NSString *)rawUUID]) {
        return (NSString *)rawUUID;
    }
    return [[NSUUID UUID] UUIDString];
}

// Una llamada con este UUID ya está registrada en CallKit (sonando o activa).
static BOOL TincadiaCallAlreadyReported(NSString *uuidString) {
    NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:uuidString];
    if (uuid == nil) { return NO; }
    CXCallObserver *observer = [[CXCallObserver alloc] init];
    for (CXCall *call in observer.calls) {
        if ([call.UUID isEqual:uuid] && !call.hasEnded) { return YES; }
    }
    return NO;
}

- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
    [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
    // REGLA DE PUSHKIT (assert en PKPushRegistry.m): reportar una llamada a
    // CallKit en ESTE run loop, antes de cualquier otro trabajo. Hasta
    // reportNewIncomingCall solo se lee el diccionario del push.
    NSMutableDictionary *payloadDict = [payload.dictionaryPayload mutableCopy] ?: [NSMutableDictionary dictionary];
    id rawUUID = payloadDict[@"callUUID"] ?: payloadDict[@"uuid"];
    NSString *uuid = TincadiaValidCallUUID(payloadDict);
    NSString *callerName = payloadDict[@"callerName"] ?: payloadDict[@"senderName"] ?: @"Tincadia";
    NSString *handle = payloadDict[@"handle"] ?: payloadDict[@"senderName"] ?: @"Tincadia Call";
    NSString *pushType = [payloadDict[@"type"] isKindOfClass:[NSString class]] ? payloadDict[@"type"] : @"";
    BOOL isTerminal = [pushType isEqualToString:@"call_ended"] || [pushType isEqualToString:@"call_missed"] || [pushType isEqualToString:@"call_rejected"];

    // Los pushes terminales llegan con el MISMO UUID que el push de ringing.
    // Reportar dos veces el mismo UUID hace que CallKit rechace el reporte
    // (CallUUIDAlreadyExists) y iOS mataría la app: se reporta una llamada
    // efímera con UUID nuevo y acto seguido se termina, junto con la original.
    BOOL alreadyReported = TincadiaCallAlreadyReported(uuid);
    NSString *reportUUID = (isTerminal || alreadyReported) ? [[NSUUID UUID] UUIDString] : uuid;
    payloadDict[@"nativeCallUUID"] = reportUUID;
    payloadDict[@"callUUID"] = reportUUID;
    payloadDict[@"originalCallUUID"] = rawUUID ?: uuid;

    // Método de clase de RNCallKeep: síncrono y sin bridge, seguro en cold start.
    [RNCallKeep setup:@{
        @"appName": @"Tincadia",
        @"handleType": @"generic",
        @"supportsVideo": @YES,
        @"includesCallsInRecents": @YES,
        @"maximumCallGroups": @2,
        @"maximumCallsPerCallGroup": @1
    }];

    [RNCallKeep reportNewIncomingCall:reportUUID
                               handle:handle
                           handleType:@"generic"
                             hasVideo:YES
                  localizedCallerName:callerName
                      supportsHolding:YES
                         supportsDTMF:YES
                     supportsGrouping:YES
                   supportsUngrouping:YES
                          fromPushKit:YES
                              payload:payloadDict
                withCompletionHandler:completion];

    if (isTerminal || alreadyReported) {
        // 3 = unanswered (aparece como perdida), 2 = remoteEnded. endCallWithUUID
        // usa reportCallWithUUID (reporte al CXProvider, no CXAction): no
        // dispara eventos JS.
        int endReason = [pushType isEqualToString:@"call_missed"] ? 3 : 2;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (isTerminal) { [RNCallKeep endCallWithUUID:uuid reason:endReason]; }
            [RNCallKeep endCallWithUUID:reportUUID reason:endReason];
        });
    }

    // La entrega del payload a JS va DESPUÉS del reporte. Con el bundle sin
    // cargar, RNVoipPushNotificationManager encola el evento para didLoadWithEvents.
    [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];
}

`;
        // Normaliza los saltos de línea previos a @end para que pasadas
        // repetidas del plugin no acumulen líneas en blanco.
        const before = contents.slice(0, lastEndIndex).replace(/\n*$/, '\n\n');
        contents = before + objcImplementation.replace(/^\n+/, '') + contents.slice(lastEndIndex);
      }

      // Quita cualquier llamada previa antes de reinsertar (idempotencia).
      contents = contents.replace(
        /\n[ \t]*\[RNVoipPushNotificationManager voipRegistration\];\n?/g,
        ''
      );

      // Registro nativo del PKPushRegistry en cold start (rama ObjC): la librería
      // ya expone voipRegistration, que crea el registry y asigna el delegate al
      // AppDelegate. Sin esto, con la app terminada no hay delegate para el push.
      const objcColdStart = '\n    [RNVoipPushNotificationManager voipRegistration];\n';
      const objcDidFinishRegex =
        /(-\s*\(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{\n)/;
      if (objcDidFinishRegex.test(contents)) {
        contents = contents.replace(objcDidFinishRegex, `$1${objcColdStart}`);
      } else {
        console.warn(
          '[withVoipAppDelegate] (objc) No se encontró didFinishLaunchingWithOptions; ' +
          'el registro nativo de PushKit en cold-start NO se inyectó.'
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
};
