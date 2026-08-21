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
