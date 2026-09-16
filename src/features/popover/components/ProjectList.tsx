import { ProjectRow } from "@/features/popover/components/ProjectRow";
import type { Project } from "@/lib/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ul className="flex min-h-0 flex-col overflow-y-auto">
      {projects.map((project) => (
        <li key={project.id} className="py-0.5">
          <ProjectRow project={project} />
        </li>
      ))}
    </ul>
  );
}
