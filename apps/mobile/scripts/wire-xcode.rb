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

project.save
puts 'wired FeegaShell, vendored Capacitor and Settings.bundle into App.xcodeproj'
