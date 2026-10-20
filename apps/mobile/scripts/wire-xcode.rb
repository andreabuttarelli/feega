require 'xcodeproj'

PACKAGES = { '../FeegaKit' => 'FeegaShell', '../vendor/capacitor-swift-pm' => nil }.freeze

project = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
target = project.targets.find { |t| t.name == 'App' }
local = project.root_object.package_references.select { |r| r.respond_to?(:relative_path) }

PACKAGES.each do |path, product_name|
  reference = local.find { |r| r.relative_path == path }
  unless reference
    reference = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
    reference.relative_path = path
    project.root_object.package_references << reference
  end
  next unless product_name

  target.package_product_dependencies.select { |d| d.package == reference && d.product_name != product_name }.each do |stale|
    target.frameworks_build_phase.files.select { |f| f.product_ref == stale }.each(&:remove_from_project)
    stale.remove_from_project
  end
  next if target.package_product_dependencies.any? { |d| d.product_name == product_name }

  product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  product.product_name = product_name
  product.package = reference
  target.package_product_dependencies << product
  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = product
  target.frameworks_build_phase.files << build_file
end

group = project.main_group.find_subpath('App', false)
group.files.select { |f| f.path == 'FeegaConfig.plist' }.each do |stale|
  target.resources_build_phase.remove_file_reference(stale)
  stale.remove_from_project
end
unless group.files.any? { |f| f.path == 'Settings.bundle' }
  target.resources_build_phase.add_file_reference(group.new_reference('Settings.bundle'))
end

(target.build_configurations + project.build_configurations).each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
end
target.build_configurations.each do |config|
  flags = Array(config.build_settings['OTHER_LDFLAGS'] || ['$(inherited)'])
  config.build_settings['OTHER_LDFLAGS'] = (flags + ['-weak_framework', 'SwiftUICore']).uniq
end

target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end
group.new_reference('App.entitlements') unless group.files.any? { |f| f.path == 'App.entitlements' }
storekit = group.files.find { |f| f.path == 'Products.storekit' } || group.new_reference('Products.storekit')

ui_tests = project.targets.find { |t| t.name == 'AppUITests' }
unless ui_tests
  ui_tests = project.new_target(:ui_test_bundle, 'AppUITests', :ios, '16.0')
  ui_tests.add_dependency(target)
  tests_group = project.main_group.new_group('AppUITests', 'AppUITests')
  ui_tests.add_file_references([tests_group.new_reference('StorePurchaseUITests.swift')])
  ui_tests.add_resources([storekit])
  ui_tests.build_configurations.each do |config|
    config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    config.build_settings['TEST_TARGET_NAME'] = 'App'
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'app.feega.mobile.uitests'
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  end
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(target, ui_tests)
scheme.launch_action.xml_element.add_element('StoreKitConfigurationFileReference', 'identifier' => '../../App/Products.storekit')
scheme.save_as(project.path, 'App', true)

puts 'wired FeegaShell, vendored Capacitor, Settings.bundle, entitlements, StoreKit config and UI tests into App.xcodeproj'
