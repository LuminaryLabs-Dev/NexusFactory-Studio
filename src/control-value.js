export function isChoiceParameter(param) {
  return param?.type === "enum" || param?.type === "select" || Array.isArray(param?.options);
}

export function choiceOptions(param) {
  return (param?.options ?? []).map((option) => {
    if (option && typeof option === "object") return { value: String(option.value), label: option.label ?? String(option.value) };
    const value = String(option);
    return { value, label: param?.optionLabels?.[value] ?? value };
  });
}

export function randomControlValue(param, randomUnit = Math.random) {
  if (isChoiceParameter(param)) {
    const options = choiceOptions(param);
    if (!options.length) return String(param?.default ?? "");
    const index = Math.min(options.length - 1, Math.floor(randomUnit() * options.length));
    return options[index].value;
  }
  const min = Number(param.minimum ?? 0);
  const max = Number(param.maximum ?? 1);
  const raw = min + (max - min) * randomUnit();
  const step = Number(param.step ?? (param.type === "integer" ? 1 : 0.01));
  const stepped = Math.round((raw - min) / step) * step + min;
  return param.type === "integer" ? Math.round(stepped) : Number(stepped.toFixed(6));
}
