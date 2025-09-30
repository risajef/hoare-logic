# Hoare proof verifier

This is an educational tool. One can use drag and drop for building a program and contracts. Then use the given inference rules to proof the program correct. If there are logical proof obligations you can try proving them using an SMT solver [Z3](https://github.com/Z3Prover/z3). The solver is in web assembly so it runs on the client side.

[Demo](https://retoweber.info/research/hoare-logic/)


## Instructions

### Run

`npm run dev`

### Build

`npm run build`

### Deploy

Copy the generated files from dist into your project. (This is how I deployed it on my [website](https://retoweber.info/research/hoare-logic/))

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.