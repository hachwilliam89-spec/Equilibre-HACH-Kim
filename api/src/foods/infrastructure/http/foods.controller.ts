import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/http/jwt-auth.guard';
import type { JwtPayload } from '../../../auth/infrastructure/http/jwt.strategy';
import { ZodValidationPipe } from '../../../auth/infrastructure/http/dto/zod-validation.pipe';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SearchFoodsUseCase } from '../../application/use-cases/search-foods.use-case';
import { ManageFavoriteFoodsUseCase } from '../../application/use-cases/manage-favorite-foods.use-case';
import { FOOD_CATEGORIES } from '../../domain/entities/food.entity';
import { FoodDto, toFoodDto } from './food.dto';
import {
  searchFoodsQuerySchema,
  type SearchFoodsQuery,
} from './search-foods.query';

@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoodsController {
  constructor(
    private readonly searchFoods: SearchFoodsUseCase,
    private readonly favoriteFoods: ManageFavoriteFoodsUseCase,
  ) {}

  @Get()
  @Roles('coach', 'utilisateur')
  @ApiOperation({
    summary: 'Rechercher les aliments de référence en lecture seule',
    description:
      'Recherche par nom et famille, sans casse ni accents. Accessible aux deux rôles authentifiés, même sans plan actif. Résultats triés par nom et paginés.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({
    name: 'categorie',
    required: false,
    enum: FOOD_CATEGORIES,
  })
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
      query.categorie,
    );
    return foods.map((food) => toFoodDto(food));
  }

  @Get('me/favorites')
  @Roles('utilisateur')
  @ApiOperation({ summary: 'Lister mes aliments favoris' })
  @ApiResponse({ status: 200, type: FoodDto, isArray: true })
  async listFavorites(
    @Req() request: Request & { user: JwtPayload },
  ): Promise<FoodDto[]> {
    const foods = await this.favoriteFoods.list(request.user.sub);
    return foods.map((food) => toFoodDto(food));
  }

  @Put('me/favorites/:foodId')
  @Roles('utilisateur')
  @HttpCode(204)
  @ApiOperation({ summary: 'Ajouter un aliment à mes favoris' })
  @ApiResponse({ status: 204, description: 'Favori enregistré' })
  @ApiResponse({ status: 404, description: 'Aliment introuvable' })
  addFavorite(
    @Req() request: Request & { user: JwtPayload },
    @Param('foodId', new ParseUUIDPipe()) foodId: string,
  ): Promise<void> {
    return this.favoriteFoods.add(request.user.sub, foodId);
  }

  @Delete('me/favorites/:foodId')
  @Roles('utilisateur')
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer un aliment de mes favoris' })
  @ApiResponse({ status: 204, description: 'Favori retiré' })
  removeFavorite(
    @Req() request: Request & { user: JwtPayload },
    @Param('foodId', new ParseUUIDPipe()) foodId: string,
  ): Promise<void> {
    return this.favoriteFoods.remove(request.user.sub, foodId);
  }
}
