Pod::Spec.new do |s|
  s.name           = 'Busca'
  s.version        = '1.0.0'
  s.summary        = 'Compromissos achaveis na busca do iPhone'
  s.author         = ''
  s.homepage       = 'https://www.nspx.dev'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
