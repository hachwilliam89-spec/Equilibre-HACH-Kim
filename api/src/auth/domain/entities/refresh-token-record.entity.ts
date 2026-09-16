export interface RefreshTokenRecordProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

export class RefreshTokenRecord {
  private constructor(private readonly props: RefreshTokenRecordProps) {}

  static create(props: RefreshTokenRecordProps): RefreshTokenRecord {
    return new RefreshTokenRecord(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revoked(): boolean {
    return this.props.revoked;
  }

  isValid(): boolean {
    return !this.props.revoked && this.props.expiresAt.getTime() > Date.now();
  }

  toProps(): RefreshTokenRecordProps {
    return { ...this.props };
  }
}
