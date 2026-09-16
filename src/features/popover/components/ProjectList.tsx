import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ProjectRow } from "@/features/popover/components/ProjectRow";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";
import type { Project } from "@/lib/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  const [list] = useAutoAnimate<HTMLUListElement>({
    duration: REVEAL_DURATION,
    easing: REVEAL_EASE,
  });

  return (
    <ul
      ref={list}
      className="soffy-project-list flex min-h-0 flex-col overflow-y-auto"
    >
      {projects.map((project) => (
        <li key={project.id} className="py-0.5">
          <ProjectRow project={project} />
        </li>
      ))}
    </ul>
  );
}
