import CleanTagInput from "@/components/ruixen/clean-tag-input";

export default function CleanTagInputDemo() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <CleanTagInput
        label="Skills"
        hint="Press Enter to add, Backspace to remove"
        defaultTags={["React", "TypeScript"]}
        style={{ width: 360 }}
      />
    </div>
  );
}
