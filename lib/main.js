const { CompositeDisposable, Disposable } = require("lumine");

/**
 * Autocomplete SOFiSTiK Package
 * Provides autocomplete suggestions for SOFiSTiK structural analysis software.
 * Integrates with language-sofistik to provide context-aware completions.
 */
module.exports = {
  /**
   * Activates the package and initializes the autocomplete provider.
   */
  activate() {
    this.provider = new Provider();
    this.disposables = new CompositeDisposable(
      lumine.config.observe("autocomplete-sofistik.textCase", (value) => {
        this.provider.setTextCase(value);
      }),
    );
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    this.disposables.dispose();
    if (this.provider) {
      this.provider.dispose();
    }
  },

  /**
   * Returns the autocomplete provider for the autocomplete-plus service.
   * @returns {Provider} The autocomplete provider instance
   */
  provideAutocomplete() {
    return this.provider;
  },

  /**
   * Consumes the sofistik.keywords service from language-sofistik package.
   * @param {Object} service - The keywords service object
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeSofistikKeywords(service) {
    if (this.provider) {
      this.provider.setKeywordsService(service);
    }
    return new Disposable(() => {
      if (this.provider) {
        this.provider.clearKeywordsService();
      }
    });
  },
};

/**
 * Autocomplete provider for SOFiSTiK files.
 * Provides context-aware suggestions based on current module and command.
 */
class Provider {
  /**
   * Creates a new Provider instance.
   */
  constructor() {
    this.scopeSelector = ".source.sofistik";
    this.keywordsService = null;
    this.textCase = true;
    this.suggestions = null;
    this.module = null;
    this.moduleRow = null;
    this.moduleNow = false;
    this.command = null;
    this.commandNow = false;
    this.param = null;
  }

  /**
   * Set the keywords service from language-sofistik
   * @param {Object} service - The keywords service provider
   */
  setKeywordsService(service) {
    this.keywordsService = service.provider;
    this.loadSuggestions();
  }

  /**
   * Clear the keywords service
   */
  clearKeywordsService() {
    this.keywordsService = null;
    this.suggestions = null;
  }

  /**
   * Set text case preference
   * @param {boolean} textCase - True for uppercase, false for lowercase
   */
  setTextCase(textCase) {
    this.textCase = textCase;
    this.loadSuggestions();
  }

  /**
   * Load suggestions from the keywords service
   */
  loadSuggestions() {
    if (!this.keywordsService) {
      return;
    }

    try {
      const fmt = (text) => {
        return this.textCase ? text : text.toLowerCase();
      };
      const ctx = this.keywordsService.withContext();
      const keywords = ctx.getKeywords();

      if (!keywords || typeof keywords !== "object") {
        return;
      }

      this.suggestions = [];

      // Build suggestions from keywords
      for (const [idc, mkeys] of Object.entries(keywords)) {
        // Add module names (except BASIC)
        if (idc !== "BASIC") {
          this.suggestions.push({
            text: fmt(idc),
            type: "class",
            rightLabel: "SOFiSTiK",
          });
        }

        if (!mkeys || typeof mkeys !== "object") {
          continue;
        }

        // Add commands and their parameters
        for (const [idk, params] of Object.entries(mkeys)) {
          this.suggestions.push({
            idc: idc,
            text: fmt(idk),
            type: "keyword",
            leftLabel: fmt(idc),
            rightLabel: "SOFiSTiK",
          });

          // Add command parameters (params is now an object: {paramName: [enums] or null})
          if (params && typeof params === "object") {
            // First pass: add enum values (higher priority)
            for (const [paramName, enumValues] of Object.entries(params)) {
              if (Array.isArray(enumValues)) {
                for (const enumVal of enumValues) {
                  this.suggestions.push({
                    idc: idc,
                    idk: idk,
                    idp: paramName,
                    text: fmt(enumVal),
                    type: "constant",
                    leftLabel: fmt(paramName),
                    rightLabel: "enum",
                  });
                }
              }
            }
            // Second pass: add parameter names (lower priority)
            for (const [paramName] of Object.entries(params)) {
              this.suggestions.push({
                idc: idc,
                idk: idk,
                text: fmt(paramName),
                type: "property",
                leftLabel: fmt(idc + " " + idk),
                rightLabel: "SOFiSTiK",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("autocomplete-sofistik: Error loading suggestions:", error);
    }
  }

  /**
   * Cleanup method
   */
  dispose() {
    this.keywordsService = null;
    this.suggestions = null;
  }

  /**
   * Gets autocomplete suggestions for the current cursor position.
   * @param {Object} options - The autocomplete request options
   * @param {TextEditor} options.editor - The text editor
   * @param {Point} options.bufferPosition - The cursor buffer position
   * @param {string} options.prefix - The prefix being typed
   * @returns {Array} Array of suggestion objects
   */
  getSuggestions(options) {
    // If no keywords service is available, return empty array
    if (!this.keywordsService || !this.suggestions) {
      return [];
    }

    const { editor, bufferPosition, prefix } = options;
    this.module = null;
    this.moduleRow = null;
    this.moduleNow = false;
    this.command = null;
    this.commandNow = false;
    this.param = null;

    this.allowSpecial(editor, bufferPosition);

    if (!this.moduleNow) {
      this.findModule(editor, bufferPosition);
      this.findCommand(editor, bufferPosition);
      this.findParam(editor, bufferPosition);
    }

    return this.findMatchingSuggestions(prefix);
  }

  /**
   * Finds the current SOFiSTiK module in the buffer by scanning backwards.
   * @param {TextEditor} editor - The text editor
   * @param {Point} bufferPosition - The current buffer position
   */
  findModule(editor, bufferPosition) {
    editor.backwardsScanInBufferRange(
      /^ *[+\-\\$]?prog +(\w+)/i,
      [[0, 0], bufferPosition],
      (object) => {
        if (object.match && object.match[1]) {
          this.module = object.match[1].toUpperCase();
          this.moduleRow = object.range.start.row;
        }
        object.stop();
      },
    );
  }

  /**
   * Escape special regex characters in a string
   * @param {string} str - String to escape
   * @returns {string} Escaped string safe for use in RegExp
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Finds the current command within the active module.
   * @param {TextEditor} editor - The text editor
   * @param {Point} bufferPosition - The current buffer position
   */
  findCommand(editor, bufferPosition) {
    if (!this.module || !this.keywordsService) {
      return;
    }

    try {
      const moduleName = this.module.toUpperCase();
      const ctx = this.keywordsService.withContext(editor);

      // Get commands for this module using the service
      const moduleCommands = ctx.getModuleCommands(moduleName);
      const basicCommands = ctx.getModuleCommands("BASIC");

      // Validate both arrays before use
      const safeModuleCommands = Array.isArray(moduleCommands) ? moduleCommands : [];
      const safeBasicCommands = Array.isArray(basicCommands) ? basicCommands : [];

      if (safeModuleCommands.length === 0 && safeBasicCommands.length === 0) {
        return;
      }

      const allCommands = [...safeModuleCommands, ...safeBasicCommands];

      // Escape regex special characters in command names
      const escapedCommands = allCommands.map((cmd) => this.escapeRegex(String(cmd)));
      const pattern = new RegExp("(?:^[ \\t]*|; *)(" + escapedCommands.join("|") + ") ", "i");

      editor.backwardsScanInBufferRange(
        pattern,
        [[this.moduleRow, 0], bufferPosition],
        (object) => {
          if (object.match && object.match[1]) {
            this.command = object.match[1].toUpperCase();
          }
          object.stop();
        },
      );
    } catch (error) {
      console.error("autocomplete-sofistik: Error finding command:", error);
    }
  }

  /**
   * Finds the current parameter before cursor (for enum completion).
   * @param {TextEditor} editor - The text editor
   * @param {Point} bufferPosition - The current buffer position
   */
  findParam(editor, bufferPosition) {
    if (!this.module || !this.command || !this.keywordsService) {
      return;
    }

    try {
      // Get the text from start of line to cursor
      const lineText = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);

      // Get parameters for this command
      const moduleName = this.module.toUpperCase();
      const commandName = this.command.toUpperCase();
      const ctx = this.keywordsService.withContext(editor);

      let params = ctx.getCommandParams(moduleName, commandName);
      const basicParams = ctx.getCommandParams("BASIC", commandName);

      // Merge params
      if (basicParams && basicParams.length > 0) {
        params = params ? [...params, ...basicParams] : basicParams;
      }

      if (!params || params.length === 0) {
        return;
      }

      // Find the last parameter before cursor that has enum values
      // Pattern: PARAM followed by space or = (indicating we're typing the value)
      const escapedParams = params.map((p) => this.escapeRegex(String(p)));
      const pattern = new RegExp(
        "(?:^|[ ;])(" + escapedParams.join("|") + ")[ =]+([^ ;=]*)?$",
        "i",
      );

      const match = lineText.match(pattern);
      if (match && match[1]) {
        this.param = match[1].toUpperCase();
      }
    } catch (error) {
      console.error("autocomplete-sofistik: Error finding param:", error);
    }
  }

  /**
   * Checks if cursor is in a special context (module declaration or command start).
   * @param {TextEditor} editor - The text editor
   * @param {Point} bufferPosition - The current buffer position
   */
  allowSpecial(editor, bufferPosition) {
    const text = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
    const pattern1 = /^ *(\w+)?$/i;
    this.commandNow = pattern1.test(text);
    const pattern2 = /^ *[+\-\\$]?prog +/i;
    this.moduleNow = pattern2.test(text);
  }

  /**
   * Filters suggestions based on current context and prefix.
   * @param {string} prefix - The typed prefix to match against
   * @returns {Array} Filtered array of matching suggestions, sorted by priority
   */
  findMatchingSuggestions(prefix) {
    prefix = prefix.toUpperCase();
    const filtered = this.suggestions.filter((suggestion) => {
      const text = suggestion.text.toUpperCase();

      if (this.moduleNow) {
        // Suggesting module names
        if (suggestion.type === "class" && text.startsWith(prefix)) {
          return true;
        }
      } else if (suggestion.idc && (this.module === suggestion.idc || suggestion.idc === "BASIC")) {
        // Check for enum suggestions first
        if (suggestion.idp && this.param) {
          // Suggesting enum values for a parameter
          if (this.command === suggestion.idk && this.param === suggestion.idp) {
            if (prefix === " " || prefix === "") {
              return true;
            }
            if (text.startsWith(prefix)) {
              return true;
            }
          }
        } else if (suggestion.idk && !suggestion.idp) {
          // Suggesting command parameters
          if (this.command === suggestion.idk) {
            if (prefix === " ") {
              return true;
            }
            if (text.startsWith(prefix)) {
              return true;
            }
          }
        } else if (!suggestion.idk && this.commandNow) {
          // Suggesting commands
          if (text.startsWith(prefix)) {
            return true;
          }
        }
      }

      return false;
    });

    // Deduplicate: prefer module-specific keywords over BASIC
    // If the same keyword exists in both current module and BASIC, keep only module's version
    const moduleKeywords = new Set();
    for (const s of filtered) {
      if (s.idc === this.module) {
        // Build unique key: type + text + command (for params)
        const key = `${s.type}:${s.text.toUpperCase()}:${s.idk || ""}:${s.idp || ""}`;
        moduleKeywords.add(key);
      }
    }

    const deduplicated = filtered.filter((s) => {
      if (s.idc === "BASIC") {
        const key = `${s.type}:${s.text.toUpperCase()}:${s.idk || ""}:${s.idp || ""}`;
        // Skip BASIC suggestion if module has the same keyword
        if (moduleKeywords.has(key)) {
          return false;
        }
      }
      return true;
    });

    // Sort by priority: enum values > parameters > commands > modules
    // This ensures params (like EPS) appear before commands (like SSLA)
    const typePriority = {
      constant: 0, // enum values (highest priority)
      property: 1, // parameters
      keyword: 2, // commands
      class: 3, // module names (lowest priority)
    };

    return deduplicated.sort((a, b) => {
      const priorityA = typePriority[a.type] ?? 4;
      const priorityB = typePriority[b.type] ?? 4;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // Same type - preserve original keyword definition order
      if (prefix) {
        return a.text.localeCompare(b.text);
      }
      return 0;
    });
  }
}
