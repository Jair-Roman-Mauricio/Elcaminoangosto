import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ConsejeriaService } from '../application/consejeria.service'
import {
  CurrentUser,
  type CurrentUserContext,
  Public,
  Roles,
  RolesGuard,
  UsuarioOpcional,
  ZodValidationPipe,
} from '../../shared'

/**
 * Los contactos van sueltos: cada consejero deja los suyos y solo salen esos.
 * Un dato en blanco no se guarda, porque un botón que no lleva a nadie es peor
 * que no tenerlo.
 */
const ContactosSchema = z
  .record(z.string(), z.string().trim())
  .default({})
  .transform((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v.length > 0)))

const ConsejeroSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  presentacion: z.string().trim().max(400).nullable().default(null),
  rol: z.string().trim().max(120).nullable().default(null),
  fotoAssetId: z.string().uuid().nullable().default(null),
  contactos: ContactosSchema,
  atiendeUrgencias: z.boolean().default(false),
  orden: z.number().int().min(0).max(999).default(0),
})

const EditarSchema = ConsejeroSchema.partial().extend({ oculto: z.boolean().optional() })

const actorDe = (u: CurrentUserContext) => ({ id: u.id, role: u.role })

/**
 * Consejería: a quién escribir cuando lo que pasa no puede esperar.
 *
 * Leer es público y sin cuenta: quien necesita este teléfono no está para
 * registrarse.
 */
@ApiTags('consejeria')
@ApiBearerAuth()
@Controller('consejeros')
@UseGuards(RolesGuard)
export class ConsejeriaController {
  constructor(private readonly consejeria: ConsejeriaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Consejeros disponibles, los de urgencias primero' })
  async listar(@UsuarioOpcional() u: CurrentUserContext | null) {
    return this.consejeria.listar(u ? actorDe(u) : null)
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Añadir un consejero' })
  async publicar(
    @CurrentUser() u: CurrentUserContext,
    @Body(new ZodValidationPipe(ConsejeroSchema)) body: z.infer<typeof ConsejeroSchema>,
  ) {
    return this.consejeria.publicar(actorDe(u), body)
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar u ocultar un consejero' })
  async editar(
    @CurrentUser() u: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditarSchema)) body: z.infer<typeof EditarSchema>,
  ) {
    await this.consejeria.editar(actorDe(u), id, body)
    return { ok: true }
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Quitar un consejero' })
  async eliminar(@CurrentUser() u: CurrentUserContext, @Param('id') id: string) {
    await this.consejeria.eliminar(actorDe(u), id)
    return { ok: true }
  }
}
