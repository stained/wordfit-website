extends SceneTree
## The game's own data for the site, as JSON: its version, the modes, difficulties and themes with the game's
## own words for them, the word lists' sizes, the coins, and small puzzles made by the game's own generator for
## the home page's "Try one" (with the Symbols cipher for each). Run by export-game.mjs:
##   godot --headless --path ../wordpuzzle -s "$PWD/scripts/export-game.gd" -- <out.json>

## Puzzles per language, and the grid the generator is given for them: Easy at a phone's 12 × 12 makes 8 × 8.
const PER_LANGUAGE := 4
const SIZE := Vector2i(12, 12)
const FIRST_SEED := 20261025


func _initialize() -> void:
	var out := OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else ""
	if out.is_empty():
		print("usage: -- <out.json>")
		quit(1)
		return
	var strings: Dictionary = load("res://scripts/autoload/loc.gd").get_script_constant_map().STRINGS
	var game: Script = load("res://scripts/autoload/game.gd")
	var consts := game.get_script_constant_map()
	var en := func(key: String) -> String: return strings[key][0]

	var data := {
		"version": ProjectSettings.get_setting("application/config/version"),
		"modes": [],
		"difficulties": [],
		"themes": [],
		"words": {},
		"coins": {"start": consts.START_COINS, "base": consts.COINS_BASE, "perStar": consts.COINS_PER_STAR,
			"daily": consts.COINS_DAILY, "place": consts.HINT_COST, "check": consts.CHECK_COST},
		"grids": {"phone": _size(consts.PHONE_GRID), "tablet": _size(consts.TABLET_GRID)},
		"puzzles": {},
	}
	for mode in consts.MODES:
		data.modes.append({"id": mode, "name": en.call(mode), "text": en.call(mode + "_desc")})
	var backdrop: Dictionary = load("res://scripts/ui/backdrop.gd").get_script_constant_map().get("PALETTES", {})
	for i in consts.DIFFICULTIES.size():
		var id: String = consts.DIFFICULTIES[i]
		var s: Dictionary = PuzzleGenerator.SETTINGS[i]
		data.difficulties.append({"id": id, "name": en.call(id), "text": en.call(id + "_desc"),
			"colours": backdrop.get(id, []).map(func(c: Color) -> String: return "#" + c.to_html(false)),
			"grid": roundi(s.grid * 100), "starters": s.starters, "decoys": s.decoys, "grouped": s.grouped})
	data.menu = backdrop.get("menu", []).map(func(c: Color) -> String: return "#" + c.to_html(false))
	for t in Themes.LIST:
		data.themes.append({"id": t.id, "name": en.call("theme_" + t.id), "text": en.call("theme_%s_desc" % t.id),
			"price": t.price, "palette": t.palette.map(func(c: String) -> String: return "#" + c),
			"tile": t.tile.map(func(c: String) -> String: return "#" + c), "decor": t.decor})

	for lang in ["en", "af", "sym"]:
		var bank := WordBank.load_language(lang)
		if lang != "sym":
			data.words[lang] = bank.words.size()
		var list := []
		for k in PER_LANGUAGE:
			var seed_value := FIRST_SEED + k * 7919 + (0 if lang == "en" else 104729 if lang == "af" else 1299709)
			var p := PuzzleGenerator.generate(bank, PuzzleGenerator.EASY, seed_value, SIZE)
			var puzzle := {"width": p.width, "height": p.height, "starters": Array(p.starters),
				"slots": p.slots.map(func(s: Dictionary) -> Dictionary:
					return {"word": s.word, "x": s.pos.x, "y": s.pos.y, "down": s.dir == Puzzle.Dir.DOWN})}
			if lang == "sym":
				puzzle.cipher = Symbols.cipher(seed_value)
			list.append(puzzle)
		data.puzzles[lang] = list

	var file := FileAccess.open(out, FileAccess.WRITE)
	file.store_string(JSON.stringify(data, " ") + "\n")
	file.close()
	print("game.json: version %s, %d puzzles" % [data.version, PER_LANGUAGE * 3])
	quit(0)


func _size(v: Vector2i) -> Array:
	return [v.x, v.y]
