export function buildInstructions(): string {
  return `You are working with a Godot 4.x project. Key conventions:

CRITICAL — Godot 3 vs 4 differences (AI models frequently get these wrong):
- yield(obj, "signal") → await obj.signal
- connect("signal", target, "method") → signal.connect(callable)
- export var → @export var
- onready var → @onready var
- tool → @tool
- instance() → instantiate()
- KinematicBody → CharacterBody3D / CharacterBody2D
- move_and_slide(velocity) → velocity is a property, move_and_slide() takes zero params
- deg2rad() → deg_to_rad()
- rand_range() → randf_range() / randi_range()

GDScript conventions:
- snake_case for variables/functions, PascalCase for classes/nodes, ALL_CAPS for constants
- Always use explicit types. Never := on Dictionary.get() or mixed-type ternaries.
- Scripts should be under 300 lines, one responsibility each.
- Signals for decoupling: child emits up, parent connects. Never reference distant nodes directly.
- Disconnect signals in _exit_tree() for autoload connections.
- .tres files must use type="Resource", never custom class names in the type field.

Use the available Godot tools for testing, diagnostics, and docs lookup rather than guessing.`;
}
