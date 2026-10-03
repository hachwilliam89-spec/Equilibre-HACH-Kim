import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SearchFoodsUseCase } from '../../application/use-cases/search-foods.use-case';
import { FoodDto } from './food.dto';
import {
  searchFoodsQuerySchema,
  type SearchFoodsQuery,
} from './search-foods.query';

@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoodsController {
  constructor(private readonly searchFoods: SearchFoodsUseCase) {}

  @Get()
  @Roles('coach', 'utilisateur')
  @ApiOperation({
    summary: 'Rechercher les aliments de référence en lecture seule',
    description:
      'Recherche par nom, sans casse ni accents. Accessible aux deux rôles authentifiés, même sans plan actif. Résultats triés par nom et paginés.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'size', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, type: FoodDto, isArray: true })
  @ApiResponse({ status: 400, description: 'Recherche ou pagination invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @ApiResponse({ status: 403, description: 'Rôle interdit' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes' })
  async search(
    @Query(new ZodValidationPipe(searchFoodsQuerySchema))
    query: SearchFoodsQuery,
  ): Promise<FoodDto[]> {
    const foods = await this.searchFoods.execute(
      query.q,
      query.page,
      query.size,
    );
    return foods.map((food) => {
      const props = food.toProps();
      return {
        id: props.id,
        nom: props.nom,
        caloriesKcalPour100g: props.caloriesKcalPour100g,
        proteinesGPour100g: props.proteinesGPour100g,
        glucidesGPour100g: props.glucidesGPour100g,
        lipidesGPour100g: props.lipidesGPour100g,
      };
    });
  }
}
