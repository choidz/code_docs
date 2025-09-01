import { useEffect, useState } from "react";
import { loadPresets, savePresets } from "../lib/presetManager";
import type { AnalysisPreset } from "../types";

export const usePresets = () => {
  const [presets, setPresets] = useState<AnalysisPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [newPresetName, setNewPresetName] = useState<string>("");

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    return presets.find((p) => p.name === presetName);
  };

  const handleSavePreset = (presetData: Omit<AnalysisPreset, "name">) => {
    if (!newPresetName.trim()) {
      alert("프리셋 이름을 입력해주세요.");
      return;
    }
    const trimmedName = newPresetName.trim();
    if (presets.some((p) => p.name === trimmedName)) {
      alert("이미 사용 중인 이름입니다.");
      return;
    }
    const newPreset: AnalysisPreset = { name: trimmedName, ...presetData };
    const updatedPresets = [...presets, newPreset].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setPresets(updatedPresets);
    savePresets(updatedPresets);
    setNewPresetName("");
    setSelectedPreset(trimmedName);
    alert(`'${trimmedName}' 프리셋이 저장되었습니다!`);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) {
      alert("삭제할 프리셋을 선택해주세요.");
      return;
    }
    if (window.confirm(`'${selectedPreset}' 프리셋을 정말 삭제하시겠습니까?`)) {
      const updatedPresets = presets.filter((p) => p.name !== selectedPreset);
      setPresets(updatedPresets);
      savePresets(updatedPresets);
      setSelectedPreset("");
    }
  };

  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedPresets: AnalysisPreset[] = JSON.parse(text);
        if (
          !Array.isArray(importedPresets) ||
          !importedPresets.every((p) => p.name && p.mode)
        ) {
          throw new Error("유효하지 않은 프리셋 파일 형식입니다.");
        }
        const mergedPresetsMap = new Map<string, AnalysisPreset>();
        [...presets, ...importedPresets].forEach((p) =>
          mergedPresetsMap.set(p.name, p)
        );
        const updatedPresets = Array.from(mergedPresetsMap.values()).sort(
          (a, b) => a.name.localeCompare(b.name)
        );
        setPresets(updatedPresets);
        savePresets(updatedPresets);
        alert(
          `${importedPresets.length}개의 프리셋을 가져왔습니다. (총 ${updatedPresets.length}개)`
        );
      } catch (error) {
        alert(
          `프리셋을 가져오는 중 오류가 발생했습니다: ${
            (error as Error).message
          }`
        );
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExportPresets = () => {
    if (presets.length === 0) {
      alert("내보낼 프리셋이 없습니다.");
      return;
    }
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "source-analyzer-presets.json";
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  return {
    presets,
    selectedPreset,
    newPresetName,
    setNewPresetName,
    handlePresetChange,
    handleSavePreset,
    handleDeletePreset,
    handleExportPresets,
    handleImportPresets,
  };
};
