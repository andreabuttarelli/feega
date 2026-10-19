require 'xcodeproj'

project = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
target = project.targets.find { |t| t.name == 'App' }

unless project.root_object.package_references.any? { |r| r.respond_to?(:relative_path) && r.relative_path == '../FeegaKit' }
  reference = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
  reference.relative_path = '../FeegaKit'
  project.root_object.package_references << reference

  product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  product.product_name = 'FeegaUI'
  product.package = reference
  target.package_product_dependencies << product

  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = product
  target.frameworks_build_phase.files << build_file
end

unless project.root_object.package_references.any? { |r| r.respond_to?(:relative_path) && r.relative_path == '../vendor/capacitor-swift-pm' }
  vendored = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
  vendored.relative_path = '../vendor/capacitor-swift-pm'
  project.root_object.package_references << vendored
end

group = project.main_group.find_subpath('App', false)
unless group.files.any? { |f| f.path == 'FeegaConfig.plist' }
  ref = group.new_reference('FeegaConfig.plist')
  target.resources_build_phase.add_file_reference(ref)
end

target.build_configurations.each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
end
project.build_configurations.each do |config|
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
end

project.save
puts 'wired FeegaKit and FeegaConfig.plist into App.xcodeproj'
