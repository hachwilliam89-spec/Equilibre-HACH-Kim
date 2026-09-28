export type MeasurementSource = 'automatique' | 'manuelle';
export type MeasurementStatut = 'valide' | 'suspecte' | 'hors-plan';

export interface MeasurementProps {
  id: string;
  userId: string;
  planId: string;
  poidsKg: number;
  receivedAt: Date;
  jourUtc: string;
  source: MeasurementSource;
  statut: MeasurementStatut;
}

/** receivedAt est fourni par l'horloge serveur, jamais par le client. */
export type MeasurementCreateProps = Omit<MeasurementProps, 'jourUtc'>;

export class Measurement {
  private constructor(private readonly props: MeasurementProps) {}

  static create(input: MeasurementCreateProps): Measurement {
    for (const value of [input.id, input.userId, input.planId]) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(
          'Identifiants de mesure, utilisateur et plan obligatoires',
        );
      }
    }
    if (!Number.isFinite(input.poidsKg) || input.poidsKg <= 0) {
      throw new Error('Le poids doit être un nombre fini strictement positif');
    }
    if (
      !(input.receivedAt instanceof Date) ||
      !Number.isFinite(input.receivedAt.getTime())
    ) {
      throw new Error('Horodatage de réception invalide');
    }
    if (!['automatique', 'manuelle'].includes(input.source)) {
      throw new Error('Source de mesure invalide');
    }
    if (!['valide', 'suspecte', 'hors-plan'].includes(input.statut)) {
      throw new Error('Statut de mesure invalide');
    }
    return new Measurement({
      ...input,
      receivedAt: new Date(input.receivedAt),
      jourUtc: input.receivedAt.toISOString().slice(0, 10),
    });
  }

  static restore(props: MeasurementProps): Measurement {
    const measurement = Measurement.create(props);
    if (measurement.props.jourUtc !== props.jourUtc) {
      throw new Error('Jour UTC incohérent avec la réception');
    }
    return measurement;
  }

  toProps(): MeasurementProps {
    return { ...this.props, receivedAt: new Date(this.props.receivedAt) };
  }
}
