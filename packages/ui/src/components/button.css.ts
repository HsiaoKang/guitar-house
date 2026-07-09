/**
 * 按钮样式（recipe variants）
 */
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../theme/contract.css";

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.font.size.md,
    lineHeight: 1,
    whiteSpace: "nowrap",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
    selectors: {
      "&:disabled": {
        opacity: 0.4,
        cursor: "not-allowed",
      },
    },
  },
  variants: {
    variant: {
      solid: {
        background: vars.color.panel2,
        color: vars.color.text,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.panel,
            borderColor: vars.color.borderStrong,
          },
        },
      },
      primary: {
        background: vars.color.accent,
        borderColor: vars.color.accent,
        color: vars.color.accentContrast,
        fontWeight: 600,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.accentStrong,
            borderColor: vars.color.accentStrong,
          },
        },
      },
      ghost: {
        background: "transparent",
        color: vars.color.text,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.panel2,
            borderColor: vars.color.borderStrong,
          },
        },
      },
    },
    tone: {
      default: {},
      danger: {
        selectors: {
          "&:hover:not(:disabled)": {
            color: vars.color.danger,
            borderColor: vars.color.danger,
          },
        },
      },
    },
    size: {
      sm: { padding: "4px 8px", fontSize: vars.font.size.sm },
      md: { padding: "7px 14px" },
      lg: { padding: "9px 18px", fontSize: vars.font.size.lg, fontWeight: 600 },
    },
    /** 激活态（如节拍器运行中变红） */
    active: {
      true: {
        background: vars.color.danger,
        borderColor: vars.color.danger,
        color: "#ffffff",
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.danger,
            borderColor: vars.color.danger,
            color: "#ffffff",
          },
        },
      },
    },
  },
  defaultVariants: {
    variant: "solid",
    tone: "default",
    size: "md",
  },
});

export const iconButton = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: vars.radius.md,
    color: vars.color.textDim,
    transition: "background 0.15s, color 0.15s",
    selectors: {
      "&:hover:not(:disabled)": {
        background: vars.color.panel2,
        color: vars.color.text,
      },
      "&:disabled": {
        opacity: 0.4,
        cursor: "not-allowed",
      },
    },
  },
  variants: {
    size: {
      sm: { width: "24px", height: "24px" },
      md: { width: "30px", height: "30px" },
      lg: { width: "36px", height: "36px" },
    },
  },
  defaultVariants: {
    size: "md",
  },
});
