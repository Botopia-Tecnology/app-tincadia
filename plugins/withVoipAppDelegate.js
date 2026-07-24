const { withAppDelegate } = require('expo/config-plugins');

/**
 * Expo Config Plugin for iOS VoIP PushKit + CallKit integration.
 *
 * Critical iOS rule: when a VoIP push arrives, the app must report the
 * incoming call to CallKit before completing the PushKit handler. If this
 * doesn't happen quickly, iOS can terminate the app and JS/Sentry may never
 * see the crash.
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

extension AppDelegate: PKPushRegistryDelegate {
    private func tincadiaEnsureCallKeepSetup() {
        #if canImport(RNCallKeep)
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

    public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        if let managerClass = NSClassFromString("RNVoipPushNotificationManager") as? NSObject.Type {
            let selector = NSSelectorFromString("didUpdatePushCredentials:forType:")
            if managerClass.responds(to: selector) {
                managerClass.perform(selector, with: pushCredentials, with: type.rawValue)
            }
        }
    }

    public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWithPayload payload: PKPushPayload, for type: PKPushType, completionHandler: @escaping () -> Void) {
        var payloadDict = payload.dictionaryPayload
        let rawUUID = (payloadDict["callUUID"] as? String) ?? (payloadDict["uuid"] as? String) ?? UUID().uuidString
        let callUUID = UUID(uuidString: rawUUID)?.uuidString ?? UUID().uuidString
        payloadDict["nativeCallUUID"] = callUUID
        payloadDict["callUUID"] = callUUID
        payloadDict["originalCallUUID"] = rawUUID
        let callerName = (payloadDict["callerName"] as? String) ?? (payloadDict["senderName"] as? String) ?? "Tincadia"
        let handle = (payloadDict["handle"] as? String) ?? (payloadDict["senderName"] as? String) ?? "Tincadia Call"

        tincadiaEnsureCallKeepSetup()

        if let managerClass = NSClassFromString("RNVoipPushNotificationManager") as? NSObject.Type {
            let selector = NSSelectorFromString("didReceiveIncomingPushWithPayload:forType:")
            if managerClass.responds(to: selector) {
                managerClass.perform(selector, with: payload, with: type.rawValue)
            }
        }

        #if canImport(RNCallKeep)
        RNCallKeep.reportNewIncomingCall(
            callUUID,
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
            withCompletionHandler: completionHandler
        )
        #else
        completionHandler()
        #endif
    }
}
#endif
`;
      contents += swiftExtension;
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

static NSString *TincadiaValidCallUUID(NSDictionary *payload) {
    id rawUUID = payload[@"callUUID"] ?: payload[@"uuid"];
    if ([rawUUID isKindOfClass:[NSString class]] && [[NSUUID alloc] initWithUUIDString:(NSString *)rawUUID]) {
        return (NSString *)rawUUID;
    }
    return [[NSUUID UUID] UUIDString];
}

- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
    [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
    NSMutableDictionary *payloadDict = [payload.dictionaryPayload mutableCopy] ?: [NSMutableDictionary dictionary];
    id rawUUID = payloadDict[@"callUUID"] ?: payloadDict[@"uuid"];
    NSString *uuid = TincadiaValidCallUUID(payloadDict);
    payloadDict[@"nativeCallUUID"] = uuid;
    payloadDict[@"callUUID"] = uuid;
    payloadDict[@"originalCallUUID"] = rawUUID ?: uuid;
    NSString *callerName = payloadDict[@"callerName"] ?: payloadDict[@"senderName"] ?: @"Tincadia";
    NSString *handle = payloadDict[@"handle"] ?: payloadDict[@"senderName"] ?: @"Tincadia Call";

    [RNCallKeep setup:@{
        @"appName": @"Tincadia",
        @"handleType": @"generic",
        @"supportsVideo": @YES,
        @"includesCallsInRecents": @YES,
        @"maximumCallGroups": @2,
        @"maximumCallsPerCallGroup": @1
    }];

    [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];

    [RNCallKeep reportNewIncomingCall:uuid
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
}

`;
        contents = contents.slice(0, lastEndIndex) + objcImplementation + contents.slice(lastEndIndex);
      }

      // Quita cualquier llamada previa antes de reinsertar (idempotencia).
      contents = contents.replace(
        /\n[ \t]*\[RNVoipPushNotificationManager voipRegistration\];/g,
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
