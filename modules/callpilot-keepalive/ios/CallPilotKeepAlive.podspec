require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CallPilotKeepAlive'
  s.version        = package['version']
  s.summary        = 'CallPilot native calling: PushKit + CallKit (iOS)'
  s.description    = 'Incoming-call VoIP pushes and the native call screen for CallPilot server push mode.'
  s.license        = 'UNLICENSED'
  s.author         = 'CallPilot'
  s.homepage       = 'https://callpilot.pro'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Same WebRTC build react-native-webrtc uses: CallKit owns the audio session,
  # so WebRTC must be told when it is activated/deactivated.
  s.dependency 'JitsiWebRTC'
  s.frameworks = 'PushKit', 'CallKit', 'AVFoundation'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
