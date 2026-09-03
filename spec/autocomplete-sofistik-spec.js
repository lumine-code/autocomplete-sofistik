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
});
