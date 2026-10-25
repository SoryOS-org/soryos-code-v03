"use client";

import React from "react";
import {
  FileCode,
  FileCode2,
  FileText,
  FileJson,
  Globe,
  Terminal,
  Image as ImageIcon,
  Database,
  File,
  Settings,
  Shield,
  Layers,
  Cpu,
} from "lucide-react";

interface FileIconProps {
  fileName: string;
  className?: string;
  isSelected?: boolean;
}

export function FileIcon({ fileName, className = "h-4 w-4 shrink-0", isSelected = false }: FileIconProps) {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  // Selected state override for high contrast when item is active in sidebar
  const activeColor = isSelected ? "text-[var(--primary-foreground)]" : "";

  // 1. Rust
  if (ext === "rs" || lowerName === "cargo.toml" || lowerName === "cargo.lock") {
    return (
      <Cpu
        className={`${className} ${activeColor || "text-[#F46623]"}`}
        aria-label="Rust file"
      />
    );
  }

  // 2. C / C++ / Headers
  if (
    ext === "c" ||
    ext === "cpp" ||
    ext === "cc" ||
    ext === "cxx" ||
    ext === "h" ||
    ext === "hpp" ||
    lowerName === "cmakelists.txt"
  ) {
    return (
      <FileCode
        className={`${className} ${activeColor || "text-[#659AD2]"}`}
        aria-label="C/C++ file"
      />
    );
  }

  // 3. Shell / Terminal Scripts
  if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "fish") {
    return (
      <Terminal
        className={`${className} ${activeColor || "text-[#10B981]"}`}
        aria-label="Shell script"
      />
    );
  }

  // 4. Kotlin & Java
  if (ext === "kt" || ext === "kts" || ext === "java" || lowerName.endsWith(".gradle")) {
    return (
      <FileCode2
        className={`${className} ${activeColor || "text-[#A855F7]"}`}
        aria-label="Kotlin/Java file"
      />
    );
  }

  // 5. TypeScript & TSX
  if (ext === "tsx" || ext === "ts") {
    return (
      <FileCode
        className={`${className} ${activeColor || "text-[#3178C6]"}`}
        aria-label="TypeScript file"
      />
    );
  }

  // 6. JavaScript & JSX
  if (ext === "jsx" || ext === "js" || ext === "mjs" || ext === "cjs") {
    return (
      <FileCode
        className={`${className} ${activeColor || "text-[#F7DF1E]"}`}
        aria-label="JavaScript file"
      />
    );
  }

  // 7. Python
  if (ext === "py" || ext === "pyw" || lowerName === "requirements.txt") {
    return (
      <FileCode2
        className={`${className} ${activeColor || "text-[#3776AB]"}`}
        aria-label="Python file"
      />
    );
  }

  // 8. Go
  if (ext === "go" || lowerName === "go.mod" || lowerName === "go.sum") {
    return (
      <FileCode2
        className={`${className} ${activeColor || "text-[#00ADD8]"}`}
        aria-label="Go file"
      />
    );
  }

  // 9. Swift & Obj-C
  if (ext === "swift" || ext === "m" || ext === "mm") {
    return (
      <FileCode2
        className={`${className} ${activeColor || "text-[#F05138]"}`}
        aria-label="Swift file"
      />
    );
  }

  // 10. HTML / HTM
  if (ext === "html" || ext === "htm") {
    return (
      <Globe
        className={`${className} ${activeColor || "text-[#E34F26]"}`}
        aria-label="HTML file"
      />
    );
  }

  // 11. CSS / SCSS / LESS
  if (ext === "css" || ext === "scss" || ext === "sass" || ext === "less") {
    return (
      <FileText
        className={`${className} ${activeColor || "text-[#CC6699]"}`}
        aria-label="CSS/Styles file"
      />
    );
  }

  // 12. JSON / Config
  if (
    lowerName === "package.json" ||
    lowerName === "tsconfig.json" ||
    ext === "json" ||
    ext === "jsonc"
  ) {
    return (
      <FileJson
        className={`${className} ${activeColor || "text-[#CBCB41]"}`}
        aria-label="JSON file"
      />
    );
  }

  // 13. Markdown
  if (ext === "md" || ext === "markdown" || ext === "mdx") {
    return (
      <FileText
        className={`${className} ${activeColor || "text-[#38BDF8]"}`}
        aria-label="Markdown file"
      />
    );
  }

  // 14. YAML / TOML / XML
  if (ext === "yml" || ext === "yaml" || ext === "toml" || ext === "xml") {
    return (
      <Settings
        className={`${className} ${activeColor || "text-[#F87171]"}`}
        aria-label="Configuration file"
      />
    );
  }

  // 15. Dotfiles, Git & Docker
  if (
    lowerName.startsWith(".env") ||
    lowerName === ".gitignore" ||
    lowerName === "dockerfile" ||
    lowerName.startsWith(".docker")
  ) {
    return (
      <Shield
        className={`${className} ${activeColor || "text-[#94A3B8]"}`}
        aria-label="Dotfile / Infrastructure"
      />
    );
  }

  // 16. Images
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext)) {
    return (
      <ImageIcon
        className={`${className} ${activeColor || "text-[#F43F5E]"}`}
        aria-label="Image file"
      />
    );
  }

  // 17. SQL / Database
  if (ext === "sql" || ext === "db" || ext === "sqlite") {
    return (
      <Database
        className={`${className} ${activeColor || "text-[#E38C00]"}`}
        aria-label="Database file"
      />
    );
  }

  // 18. Default fallback file
  return (
    <File
      className={`${className} ${activeColor || "text-[var(--muted-foreground)]"}`}
      aria-label="File"
    />
  );
}
