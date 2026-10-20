import { envSchema } from './env.schema';

const config = {
  MONGO_URI: 'mongodb://localhost/equilibre_test',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'another-test-secret-at-least-32-characters',
};

describe('configuration des proxys de confiance', () => {
  it('ne fait confiance à aucun proxy par défaut', () => {
    expect(envSchema.parse(config).TRUSTED_PROXY_IPS).toEqual([]);
  });

  it('accepte des adresses IPv4 et IPv6 exactes', () => {
    expect(
      envSchema.parse({ ...config, TRUSTED_PROXY_IPS: ' 172.20.0.2, ::1 ' })
        .TRUSTED_PROXY_IPS,
    ).toEqual(['172.20.0.2', '::1']);
  });

  it.each([
    'true',
    '1',
    '*',
    '0.0.0.0/0',
    '172.20.0.0/16',
    'caddy',
    '256.1.1.1',
  ])(
    'refuse une confiance implicite ou une adresse invalide : %s',
    (TRUSTED_PROXY_IPS) => {
      expect(
        envSchema.safeParse({ ...config, TRUSTED_PROXY_IPS }).success,
      ).toBe(false);
    },
  );
});
