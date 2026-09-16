import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // rootDir: '.' scope a ts-jest uniquement (jest tourne depuis la racine
    // du projet). TS 6 exige desormais un rootDir explicite des que le
    // compilateur ne voit qu'un sous-ensemble de fichiers (TS5011) -- c'est
    // le cas ici, ts-jest compile fichier par fichier. N'affecte ni
    // tsconfig.json (IDE), ni tsconfig.build.json (nest build).
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { rootDir: '.' } }],
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
