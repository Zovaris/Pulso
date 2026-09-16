import { FolderSimple } from "@phosphor-icons/react";
import type { Project } from "@/lib/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ul className="flex min-h-0 flex-col overflow-y-auto">
      {projects.map((project) => (
        <li key={project.id} className="flex items-start gap-2.5 py-1.5">
          <FolderSimple size={14} className="mt-0.5 shrink-0 text-faint" />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium">{project.name}</p>
            <p
              className="mt-0.5 truncate text-[11.5px] text-mist"
              title={project.path}
            >
              {project.path}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
