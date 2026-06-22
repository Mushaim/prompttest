// Minimal {{var}} templating — no dependency, no logic, just substitution.
export function render(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) =>
    key in vars ? vars[key] : `{{${key}}}`
  );
}
