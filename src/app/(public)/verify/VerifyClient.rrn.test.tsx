import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Step3Form } from "./VerifyClient";

describe("verification resident-registration input", () => {
  it("collects only the first back-half digit needed for birth-date derivation", () => {
    const onChange = vi.fn();
    render(
      <Step3Form
        form={{ name: "홍길동", rrnFront: "900101", rrnBackFirst: "", phone: "01012345678" }}
        onChange={onChange}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        loading={false}
        error={null}
      />
    );

    expect(screen.queryByPlaceholderText("뒤 7자리")).not.toBeInTheDocument();
    const backFirst = screen.getByPlaceholderText("뒷자리 첫 숫자");
    fireEvent.change(backFirst, { target: { value: "3456789" } });
    expect(onChange).toHaveBeenCalledWith("rrnBackFirst", "3");
  });
});
