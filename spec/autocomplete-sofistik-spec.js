// The provider consumes `sofistik.environment`, which returns completion data
// bound to the release and language of the requested editor. The specs feed a
// small mock of that service, so the suite runs without it installed.

const CATALOGUE = {
  BASIC: {
    CTRL: { OPT: ["WARP", "AXIA"], VAL: null },
  },
  AQUA: {
    MAT: { NO: null, FCK: ["C20", "C25"] },
    SECT: { NO: null, MNO: null },
  },
};

function createReleaseKeywords(catalogue = CATALOGUE) {
  return {
    getVersion: () => "2026",
    getLanguage: () => "en",
    getKeywords: () => catalogue,
    getModuleKeywords: (name) => catalogue[name] || null,
    getModuleNames: () => Object.keys(catalogue),
    getModuleCommands: (name) => (catalogue[name] ? Object.keys(catalogue[name]) : []),
    getCommandParams: (name, cmd) =>
      catalogue[name] && catalogue[name][cmd] ? Object.keys(catalogue[name][cmd]) : [],
  };
}

function createMockEnvironmentService(context = createReleaseKeywords()) {
  return {
    name: "sofistik-environment",
    version: "1.0.0",
    provider: { getKeywordContext: () => context },
  };
}

describe("autocomplete-sofistik", () => {
  let editor, provider, mainModule;

  function suggestionsAt(text, row, column, prefix) {
    editor.setText(text);
    return provider.getSuggestions({
      editor,
      bufferPosition: { row, column },
      prefix,
    });
  }

  beforeEach(async () => {
    const pack = await lumine.packages.activatePackage("autocomplete-sofistik");
    mainModule = pack.mainModule;
    mainModule.consumeSofistikEnvironment(createMockEnvironmentService());
    provider = mainModule.provideAutocomplete();
    editor = await lumine.workspace.open("test.dat");
  });

  it("exposes an autocomplete provider scoped to SOFiSTiK sources", () => {
    expect(provider).toBeDefined();
    expect(provider.scopeSelector).toBe(".source.sofistik");
    expect(typeof provider.getSuggestions).toBe("function");
  });

  it("registers with the bundled autocomplete package through the services hub", async () => {
    lumine.notifications.clear();
    const pack = await lumine.packages.activatePackage("autocomplete");
    const { providerManager } = pack.mainModule.autocompleteManager;
    expect(providerManager.metadataForProvider(provider)).toBeTruthy();
    const errors = lumine.notifications
      .getNotifications()
      .filter((notification) => notification.getType() === "error");
    expect(errors).toEqual([]);
  });

  it("suggests module names after +prog", () => {
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]).toEqual({
      text: "AQUA",
      type: "class",
      rightLabel: "SOFiSTiK",
    });
  });

  it("suggests commands of the current module at the start of a line", () => {
    const suggestions = suggestionsAt("+prog aqua\nMA", 1, 2, "MA");
    expect(suggestions.map((s) => s.text)).toEqual(["MAT"]);
    expect(suggestions[0].type).toBe("keyword");
    expect(suggestions[0].leftLabel).toBe("AQUA");
  });

  it("includes BASIC commands but prefers the module version on collisions", () => {
    const suggestions = suggestionsAt("+prog aqua\nCT", 1, 2, "CT");
    expect(suggestions.map((s) => s.text)).toEqual(["CTRL"]);
    expect(suggestions[0].idc).toBe("BASIC");
  });

  it("suggests parameters of the current command", () => {
    const suggestions = suggestionsAt("+prog aqua\nmat n", 1, 5, "n");
    expect(suggestions.map((s) => s.text)).toEqual(["NO"]);
    expect(suggestions[0].type).toBe("property");
    expect(suggestions[0].leftLabel).toBe("AQUA MAT");
  });

  it("suggests enum values for the current parameter", () => {
    const suggestions = suggestionsAt("+prog aqua\nmat fck c2", 1, 10, "c2");
    expect(suggestions.map((s) => s.text)).toEqual(["C20", "C25"]);
    for (const suggestion of suggestions) {
      expect(suggestion.type).toBe("constant");
      expect(suggestion.leftLabel).toBe("FCK");
      expect(suggestion.rightLabel).toBe("enum");
    }
  });

  it("consumes only the environment service", () => {
    const manifest = require("../package.json");
    expect(manifest.version).toBe("1.0.0");
    expect(Object.keys(manifest.consumedServices)).toEqual(["sofistik.environment"]);
  });

  it("returns no suggestions when the environment provider is missing", () => {
    mainModule.consumeSofistikEnvironment(createMockEnvironmentService()).dispose();
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions).toEqual([]);
  });

  it("returns no suggestions when the environment has no keyword context", () => {
    mainModule.consumeSofistikEnvironment(createMockEnvironmentService(null));
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions).toEqual([]);
  });

  it("asks the environment for the editor's release-bound keyword context", () => {
    const asked = [];
    mainModule.consumeSofistikEnvironment({
      name: "sofistik-environment",
      version: "1.0.0",
      provider: {
        getKeywordContext(context) {
          asked.push(context);
          return createReleaseKeywords();
        },
      },
    });

    suggestionsAt("+prog aqua\nsect ", 1, 5, "");
    expect(asked.length).toBe(1);
    expect(asked[0]).toEqual({ editor });
  });

  it("uses the keyword context returned for each request", () => {
    let context = createReleaseKeywords();
    mainModule.consumeSofistikEnvironment({
      name: "sofistik-environment",
      version: "1.0.0",
      provider: { getKeywordContext: () => context },
    });

    expect(suggestionsAt("+prog a", 0, 7, "a").map((s) => s.text)).toEqual(["AQUA"]);

    context = createReleaseKeywords({ SOFILOAD: { LC: { NO: null } } });
    expect(suggestionsAt("+prog s", 0, 7, "s").map((s) => s.text)).toEqual(["SOFILOAD"]);
  });

  it("honors the lowercase suggestions setting", () => {
    lumine.config.set("autocomplete-sofistik.textCase", false);
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions.map((s) => s.text)).toEqual(["aqua"]);
  });

  it("reuses module declarations while typing far below them", () => {
    const text = "+prog aqua\n" + "42\n".repeat(4000) + "mat n";
    expect(suggestionsAt(text, 4001, 5, "n").map((s) => s.text)).toEqual(["NO"]);
    const buffer = editor.getBuffer();
    spyOn(buffer, "scan").and.callThrough();
    spyOn(editor, "backwardsScanInBufferRange").and.callThrough();

    buffer.insert([4001, 5], "o");
    const suggestions = provider.getSuggestions({
      editor,
      bufferPosition: { row: 4001, column: 6 },
      prefix: "no",
    });

    expect(suggestions.map((s) => s.text)).toEqual(["NO"]);
    expect(buffer.scan).not.toHaveBeenCalled();
    for (const [, range] of editor.backwardsScanInBufferRange.calls.allArgs()) {
      expect(range[0][0]).toBeGreaterThan(3500);
    }
  });

  it("updates the module when its declaration is edited, inserted, or removed", () => {
    mainModule.consumeSofistikEnvironment(
      createMockEnvironmentService(
        createReleaseKeywords({
          AQUA: { MAT: { NO: null } },
          SOFILOAD: { LC: { NO: null } },
        }),
      ),
    );
    const request = (row, prefix) =>
      provider
        .getSuggestions({
          editor,
          bufferPosition: { row, column: 1 },
          prefix,
        })
        .map((s) => s.text);
    editor.setText("+prog aqua\nM\nL");
    expect(request(1, "M")).toEqual(["MAT"]);

    const buffer = editor.getBuffer();
    buffer.setTextInRange(
      [
        [0, 6],
        [0, 10],
      ],
      "sofload",
    );
    expect(request(2, "L")).toEqual([]);
    buffer.setTextInRange(
      [
        [0, 6],
        [0, 13],
      ],
      "sofiload",
    );
    expect(request(2, "L")).toEqual(["LC"]);

    buffer.insert([2, 0], "+prog aqua\n");
    expect(request(1, "L")).toEqual(["LC"]);
    expect(request(3, "M")).toEqual(["MAT"]);
    buffer.delete([
      [2, 0],
      [3, 0],
    ]);
    expect(request(2, "L")).toEqual(["LC"]);
  });

  it("keeps module positions correct after several edits in one transaction", () => {
    mainModule.consumeSofistikEnvironment(
      createMockEnvironmentService(
        createReleaseKeywords({
          AQUA: { MAT: { NO: null } },
          SOFILOAD: { LC: { NO: null } },
        }),
      ),
    );
    editor.setText("+prog aqua\nM\n+prog sofload\nL");
    const request = (row, prefix) =>
      provider
        .getSuggestions({
          editor,
          bufferPosition: { row, column: 1 },
          prefix,
        })
        .map((s) => s.text);
    expect(request(1, "M")).toEqual(["MAT"]);

    const buffer = editor.getBuffer();
    buffer.transact(() => {
      buffer.setTextInRange(
        [
          [2, 6],
          [2, 13],
        ],
        "aqua",
      );
      buffer.setTextInRange(
        [
          [0, 6],
          [0, 10],
        ],
        "sofiload",
      );
      buffer.insert([0, 0], "$ comment\n");
    });
    expect(request(2, "L")).toEqual(["LC"]);
    expect(request(4, "M")).toEqual(["MAT"]);
    buffer.undo();
    expect(request(1, "M")).toEqual(["MAT"]);
    expect(request(3, "L")).toEqual([]);
    buffer.redo();
    expect(request(4, "M")).toEqual(["MAT"]);
  });

  it("finds a preceding command beyond a search window and notices command edits", () => {
    const text = "+prog aqua\nmat 1\n" + "42\n".repeat(700) + "42 n";
    expect(suggestionsAt(text, 702, 4, "n").map((s) => s.text)).toEqual(["NO"]);
    editor.getBuffer().setTextInRange(
      [
        [1, 0],
        [1, 3],
      ],
      "ctrl",
    );
    expect(
      provider
        .getSuggestions({
          editor,
          bufferPosition: { row: 702, column: 4 },
          prefix: "o",
        })
        .map((s) => s.text),
    ).toEqual(["OPT"]);
  });

  it("keeps command lookup inside the current module", () => {
    mainModule.consumeSofistikEnvironment(
      createMockEnvironmentService(
        createReleaseKeywords({
          AQUA: { MAT: { NO: null } },
          SOFILOAD: { LC: { NO: null } },
        }),
      ),
    );
    const suggestions = suggestionsAt("+prog aqua\nmat 1\n+prog sofiload\n42 n", 3, 4, "n");
    expect(suggestions).toEqual([]);
  });

  it("keeps completion context independent for different buffers", async () => {
    editor.setText("+prog aqua\nmat n");
    const second = await lumine.workspace.open();
    second.setText("+prog aqua\nctrl o");
    const request = (target, prefix) =>
      provider
        .getSuggestions({
          editor: target,
          bufferPosition: target.getBuffer().getEndPosition(),
          prefix,
        })
        .map((s) => s.text);
    expect(request(editor, "n")).toEqual(["NO"]);
    expect(request(second, "o")).toEqual(["OPT"]);
    expect(request(editor, "n")).toEqual(["NO"]);
  });

  it("releases buffer subscriptions when the provider is disposed", () => {
    suggestionsAt("+prog aqua\nmat n", 1, 5, "n");
    spyOn(provider, "updateModuleIndex").and.callThrough();
    provider.dispose();
    editor.getBuffer().insert([1, 5], "o");
    expect(provider.updateModuleIndex).not.toHaveBeenCalled();
  });
});
