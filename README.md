# autocomplete-sofistik

Autocompletion for SOFiSTiK modules, commands, and parameters.

> [!WARNING]
> **This package is deprecated.** SOFiSTiK completion is now provided by [ide-sofistik](https://github.com/lumine-code/ide-sofistik) through [ide-client](https://github.com/lumine-code/ide-client) and [autocomplete](https://github.com/lumine-code/autocomplete). This repository is archived and no longer maintained.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

## Features

- **Context-aware suggestions**: autocomplete adapts to your current module and command context.
- **Module completion**: suggests SOFiSTiK module names when typing `+PROG`.
- **Command completion**: provides available commands for the current module.
- **Parameter completion**: suggests valid parameters for the current command.
- **Enum completion**: suggests valid enum values for the current parameter.
- **Configurable case**: choose between uppercase or lowercase suggestions.

## Migration

Disable or uninstall `autocomplete-sofistik` and install `ide-sofistik` with `ide-client`. Keep `autocomplete` installed to display completion suggestions.

```sh
lumine --install lumine-code/ide-client
lumine --install lumine-code/ide-sofistik
lumine --install lumine-code/autocomplete
```

## Services

- `autocomplete.provider`: provided to the autocomplete system to supply SOFiSTiK suggestions in `source.sofistik` files.
- `sofistik.environment`: consumed to obtain the release-bound completion data for each file, so suggestions match what the linter and the tooling use.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
