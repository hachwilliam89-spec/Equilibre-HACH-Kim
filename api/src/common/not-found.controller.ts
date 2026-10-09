import { All, Controller, NotFoundException } from '@nestjs/common';

/** Fait passer les URL inconnues par le filtre global Problem Details. */
@Controller()
export class NotFoundController {
  @All('*path')
  reject(): never {
    throw new NotFoundException('Route API introuvable');
  }
}
