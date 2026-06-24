import { useTranslation } from "react-i18next";
import "./index";

export function useT() {
  return useTranslation().t;
}
