import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7, authHeader.length);
      try {
        const decoded = this.jwtService.verify(token);
        const user = await this.usersService.findById(decoded.sub);
        if (user) {
          res.locals.user = user;
        }
      } catch (error) {
        // Token is invalid, but we'll continue without setting res.locals.user
      }
    }
    next();
  }
}
