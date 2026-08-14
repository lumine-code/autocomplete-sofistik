# autocomplete-sofistik

Autocompletion for SOFiSTiK modules, commands, and parameters.

> **NOTE**: This package is not an official SOFiSTiK product and is not affiliated with or endorsed by SOFiSTiK AG.

## Features

- **Context-aware suggestions**: autocomplete adapts to your current module and command context.
- **Module completion**: suggests SOFiSTiK module names when typing `+PROG`.
- **Command completion**: provides available commands for the current module.
- **Parameter completion**: suggests valid parameters for the current command.
- **Enum completion**: suggests valid enum values for the current parameter.
- **Configurable case**: choose between uppercase or lowercase suggestions.

## Installation

To install `autocomplete-sofistik` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/autocomplete-sofistik`.

## Services

- `autocomplete.provider`: provided to the autocomplete system to supply SOFiSTiK suggestions in `source.sofistik` files.
- `sofistik.keywords`: consumed to read the SOFiSTiK keyword data a release ships.
- `sofistik.environment`: consumed to resolve which release and language a file is for, so suggestions match what the linter and the tooling use.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
