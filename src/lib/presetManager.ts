// localStorage에 프리셋 데이터를 저장하고 불러오는 함수들을 정의합니다.
import type { AnalysisPreset } from "../types";

const PRESET_STORAGE_KEY = "source-analyzer-presets";

export const loadPresets = (): AnalysisPreset[] => {
  try {
    const storedPresets = localStorage.getItem(PRESET_STORAGE_KEY);
    return storedPresets ? JSON.parse(storedPresets) : [];
  } catch (error) {
    console.error("Failed to load presets from localStorage", error);
    return [];
  }
};

export const savePresets = (presets: AnalysisPreset[]): void => {
  try {
    const data = JSON.stringify(presets);
    localStorage.setItem(PRESET_STORAGE_KEY, data);
  } catch (error) {
    console.error("Failed to save presets to localStorage", error);
  }
};
