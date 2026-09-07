import {
  type CSSProperties,
  type MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Grade } from "ts-fsrs";
import { getCurrentProblem } from "@/content/problem-data";
import type { Translations } from "@/i18n";
import { sendMessage } from "@/infrastructure/browser/messages";
import { watchStoredTranslations } from "@/infrastructure/storage/translations";
import { RatingMenu } from "./RatingMenu";
import { Tooltip } from "./Tooltip";
import { LEETSRS_BUTTON_COLOR, THEME_COLORS, useDarkMode } from "./theme";
import styles from "./ui.module.css";

export function LeetSrsControl() {
  const container = useRef<HTMLDivElement>(null);
  const [tooltipTarget, setTooltipTarget] = useState<HTMLButtonElement | null>(
    null,
  );
  const [t, setTranslations] = useState<Translations | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(
    () =>
      watchStoredTranslations(setTranslations, (error) => {
        console.error("Failed to load content translations:", error);
      }),
    [],
  );

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (
        container.current &&
        !event.composedPath().includes(container.current)
      )
        setMenuOpen(false);
    };
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, []);

  async function handleRate(rating: number) {
    const problem = await getCurrentProblem();
    if (!problem) return;

    await sendMessage("rateCard", {
      input: { ...problem, rating: rating as Grade },
    });
  }

  async function handleAddWithoutRating() {
    const problem = await getCurrentProblem();
    if (!problem) return;

    await sendMessage("addCard", { problem });
  }

  if (!t) return null;

  return (
    <div ref={container} style={{ position: "relative", display: "flex" }}>
      <LeetSrsButton
        t={t}
        onClick={() => setMenuOpen((open) => !open)}
        expanded={menuOpen}
        onMouseEnter={(event) => setTooltipTarget(event.currentTarget)}
        onMouseLeave={() => setTooltipTarget(null)}
      />
      {menuOpen && (
        <RatingMenu
          t={t}
          onRate={handleRate}
          onAddWithoutRating={handleAddWithoutRating}
          onSelect={() => setMenuOpen(false)}
        />
      )}
      {tooltipTarget &&
        createPortal(
          <Tooltip target={tooltipTarget} text={t.app.name} />,
          document.body,
        )}
    </div>
  );
}

export function LeetSrsButton({
  onClick,
  t,
  expanded = false,
  onMouseEnter,
  onMouseLeave,
}: {
  onClick: () => void;
  t: Translations;
  expanded?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <button
      type="button"
      className={styles.toolbarButton}
      title={t.app.name}
      aria-label={t.app.name}
      aria-expanded={expanded}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={
        {
          color: LEETSRS_BUTTON_COLOR,
          "--button-bg": colors.bgToolbarButton,
          "--button-hover": colors.bgAddButtonHover,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <svg
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 16, height: 16 }}
        role="img"
      >
        <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
        <path d="M5.63 7.16l0 .01" />
        <path d="M4.06 11l0 .01" />
        <path d="M4.63 15.1l0 .01" />
        <path d="M7.16 18.37l0 .01" />
        <path d="M11 19.94l0 .01" />
      </svg>
    </button>
  );
}
