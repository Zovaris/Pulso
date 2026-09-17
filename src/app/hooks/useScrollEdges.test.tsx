import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScrollEdges } from "@/app/hooks/useScrollEdges";

function Probe() {
  const { box, edges } = useScrollEdges<HTMLDivElement>();

  return (
    <div ref={box} data-edge={edges}>
      <div />
      <div />
    </div>
  );
}

function rect(bottom: number): DOMRect {
  return {
    top: 0,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function setUp(options: {
  frameBottom: number;
  contentBottom: number;
  scrollTop: number;
}) {
  const { container } = render(<Probe />);
  const scroller = container.firstElementChild as HTMLElement;
  const last = scroller.lastElementChild as HTMLElement;

  scroller.getBoundingClientRect = () => rect(options.frameBottom);
  last.getBoundingClientRect = () => rect(options.contentBottom);
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    writable: true,
    value: options.scrollTop,
  });

  return scroller;
}

describe("useScrollEdges", () => {
  it("says nothing when everything fits", () => {
    const scroller = setUp({
      frameBottom: 274,
      contentBottom: 200,
      scrollTop: 0,
    });

    fireEvent.scroll(scroller);

    expect(scroller.dataset.edge).toBe("none");
  });

  it("marks the bottom when rows are hidden there", () => {
    const scroller = setUp({
      frameBottom: 274,
      contentBottom: 470,
      scrollTop: 0,
    });

    fireEvent.scroll(scroller);

    expect(scroller.dataset.edge).toBe("bottom");
  });

  it("marks both edges once it is scrolled into the middle", () => {
    const scroller = setUp({
      frameBottom: 274,
      contentBottom: 470,
      scrollTop: 40,
    });

    fireEvent.scroll(scroller);

    expect(scroller.dataset.edge).toBe("both");
  });

  it("keeps only the top once the end is reached", () => {
    const scroller = setUp({
      frameBottom: 274,
      contentBottom: 270,
      scrollTop: 196,
    });

    fireEvent.scroll(scroller);

    expect(scroller.dataset.edge).toBe("top");
  });

  it("re-reads the edges when the rows change", async () => {
    const scroller = setUp({
      frameBottom: 274,
      contentBottom: 200,
      scrollTop: 0,
    });

    const added = document.createElement("div");
    added.getBoundingClientRect = () => rect(470);
    scroller.append(added);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scroller.dataset.edge).toBe("bottom");
  });
});
