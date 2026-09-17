import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useCallback } from "react";
import { useScrollEdges } from "@/app/hooks/useScrollEdges";
import { ProjectRow } from "@/features/popover/components/ProjectRow";
import { REVEAL_DURATION, REVEAL_EASE } from "@/lib/motion";
import type { Project } from "@/lib/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  const [list] = useAutoAnimate<HTMLUListElement>({
    duration: REVEAL_DURATION,
    easing: REVEAL_EASE,
  });
  const { box, edges } = useScrollEdges<HTMLUListElement>();
  const attach = useCallback(
    (node: HTMLUListElement | null) => {
      list(node);
      box.current = node;
    },
    [list, box],
  );

  return (
    <div className="pulso-scroll" data-edge={edges}>
      <ul ref={attach} className="pulso-project-list flex flex-col">
        {projects.map((project) => (
          <li key={project.id} className="py-0.5">
            <ProjectRow project={project} />
          </li>
        ))}
      </ul>
    </div>
  );
}
