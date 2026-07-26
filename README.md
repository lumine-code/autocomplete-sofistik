# autocomplete-sofistik

Autocompletion for SOFiSTiK modules, commands, and parameters.

Get hints as you type the SOFiSTiK input.

## Features

- **Context-aware suggestions**: autocomplete adapts to your current module and command context.
- **Module completion**: suggests SOFiSTiK module names when typing `+PROG`.
- **Command completion**: provides available commands for the current module.
- **Parameter completion**: suggests valid parameters for the current command.
- **Enum completion**: suggests valid enum values for the current parameter.
- **Configurable case**: choose between uppercase or lowercase suggestions.

## Installation

To install `autocomplete-sofistik` search for _autocomplete-sofistik_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/autocomplete-sofistik`.

This package requires [language-sofistik](https://github.com/lumine-code/language-sofistik).

## Services

- **[autocomplete.provider](https://lumine-code.github.io/docs.html#services/autocomplete.provider)** (`1.0.0`): provided to the autocomplete system to supply SOFiSTiK suggestions in `source.sofistik` files.
- **[sofistik.keywords](https://lumine-code.github.io/docs.html#services/sofistik.keywords)** (`^1.0.0`): consumed to read version- and language-aware SOFiSTiK keyword data from `language-sofistik`.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
