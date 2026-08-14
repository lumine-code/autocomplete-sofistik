// The provider consumes two services: `sofistik.keywords` from language-sofistik
// for the words, and `sofistik.environment` for which release a file is for.
// The specs feed small mocks of both (same shape as the real providers:
// forRelease() -> keywords bound to a release, resolve() -> that release), so
// the suite runs without either package installed.

const KEYWORDS = {
  BASIC: {
    CTRL: { OPT: ["WARP", "AXIA"], VAL: null },
  },
  AQUA: {
    MAT: { NO: null, FCK: ["C20", "C25"] },
    SECT: { NO: null, MNO: null },
  },
};

function createMockEnvironmentService(version = "2026", language = "en") {
  return {
    name: "sofistik-environment",
    version: "1.0.0",
    provider: { resolve: () => ({ version, language }) },
  };
}

function createMockKeywordsService() {
  const context = {
    getVersion: () => "2026",
    getLanguage: () => "en",
    getKeywords: () => KEYWORDS,
    getModuleKeywords: (name) => KEYWORDS[name] || null,
    getModuleNames: () => Object.keys(KEYWORDS),
    getModuleCommands: (name) => (KEYWORDS[name] ? Object.keys(KEYWORDS[name]) : []),
    getCommandParams: (name, cmd) =>
      KEYWORDS[name] && KEYWORDS[name][cmd] ? Object.keys(KEYWORDS[name][cmd]) : [],
  };
  return {
    name: "sofistik-keywords",
    version: "1.0.0",
    provider: { forRelease: () => context },
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
    mainModule.consumeSofistikKeywords(createMockKeywordsService());
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

  it("returns no suggestions when the keywords service is missing", () => {
    mainModule.consumeSofistikKeywords(createMockKeywordsService()).dispose();
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions).toEqual([]);
  });

  it("asks the environment which release the suggestions are for", () => {
    const asked = [];
    mainModule.consumeSofistikEnvironment({
      name: "sofistik-environment",
      version: "1.0.0",
      provider: {
        resolve(context) {
          asked.push(context);
          return { version: "2022", language: "de" };
        },
      },
    });
    const releases = [];
    mainModule.consumeSofistikKeywords({
      name: "sofistik-keywords",
      version: "1.0.0",
      provider: {
        forRelease(version, language) {
          releases.push({ version, language });
          return createMockKeywordsService().provider.forRelease();
        },
      },
    });

    suggestionsAt("+prog aqua\nsect ", 1, 5, "");
    // The completion must not decide the release itself, or it will offer words
    // the linter rejects and the tooling will not run.
    expect(releases.at(-1)).toEqual({ version: "2022", language: "de" });
    // And it asks about the file being completed, not about whatever is active.
    expect(asked.some((context) => context.editor === editor)).toBe(true);
  });

  it("honors the lowercase suggestions setting", () => {
    lumine.config.set("autocomplete-sofistik.textCase", false);
    const suggestions = suggestionsAt("+prog a", 0, 7, "a");
    expect(suggestions.map((s) => s.text)).toEqual(["aqua"]);
  });
});
