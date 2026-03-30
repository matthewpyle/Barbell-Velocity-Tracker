import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#FFFFFF";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#FFFFFF",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,

    surface: "#F4F6F8",
    border: "#D9E0E6",
    muted: "#687076",
    subtext: "#4E5965",
    primary: "#0a7ea4",
    success: "#1F9D55",
    danger: "#D64545",
  },
  dark: {
    text: "#FFFFFF",
    background: "#0B0F18",
    tint: tintColorDark,
    icon: "#8D99AE",
    tabIconDefault: "#8D99AE",
    tabIconSelected: "#FFFFFF",

    surface: "#151B26",
    border: "#222A36",
    muted: "#8D99AE",
    subtext: "#AAB4C3",
    primary: "#5B8CFF",
    success: "#7CFFB2",
    danger: "#FF8A8A",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
