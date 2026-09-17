import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan } from '../../domain/entities/plan.entity';
import { PlanRepositoryPort } from '../../domain/ports/plan-repository.port';
import { PlanDocument, PlanDocumentClass } from './plan.schema';

@Injectable()
export class MongoosePlanRepository implements PlanRepositoryPort {
  constructor(
    @InjectModel(PlanDocumentClass.name)
    private readonly planModel: Model<PlanDocument>,
  ) {}

  async create(plan: Plan): Promise<Plan> {
    const props = plan.toProps();
    const doc = await this.planModel.create({
      _id: props.id,
      userId: props.userId,
      coachId: props.coachId,
      poidsDepart: props.poidsDepart,
      poidsCible: props.poidsCible,
      dateDebut: props.dateDebut,
      dateCible: props.dateCible,
      imcCible: props.imcCible,
      niveauActivite: props.niveauActivite,
      budgetCalorique: props.budgetCalorique,
      budgetPlafonneAuBmr: props.budgetPlafonneAuBmr,
      statut: props.statut,
    });
    return this.toDomain(doc);
  }

  async findById(id: string): Promise<Plan | null> {
    const doc = await this.planModel.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findActiveByUserId(userId: string): Promise<Plan | null> {
    const doc = await this.planModel
      .findOne({ userId, statut: 'actif' })
      .exec();
    if (!doc) {
      return null;
    }

    const plan = this.toDomain(doc);
    if (plan.hasExpired(new Date())) {
      plan.terminate();
      await this.save(plan);
      return null;
    }

    return plan;
  }

  async save(plan: Plan): Promise<Plan> {
    const props = plan.toProps();
    const doc = await this.planModel.findByIdAndUpdate(
      props.id,
      { $set: props },
      { returnDocument: 'after' },
    );
    return this.toDomain(doc!);
  }

  private toDomain(doc: PlanDocument): Plan {
    return Plan.restore({
      id: doc._id.toString(),
      userId: doc.userId,
      coachId: doc.coachId,
      poidsDepart: doc.poidsDepart,
      poidsCible: doc.poidsCible,
      dateDebut: doc.dateDebut,
      dateCible: doc.dateCible,
      imcCible: doc.imcCible,
      niveauActivite: doc.niveauActivite,
      budgetCalorique: doc.budgetCalorique,
      budgetPlafonneAuBmr: doc.budgetPlafonneAuBmr,
      statut: doc.statut,
      createdAt: doc.createdAt,
    });
  }
}
