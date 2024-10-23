import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '../users/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async signUp(email: string, password: string, name: string) {
    try {
      if (!email || !password || !name) {
        throw new BadRequestException('Email, password, and name are required');
      }
      const user = await this.usersService.create(email, password, name);
      const tokens = await this.getTokens(user._id, user.email);
      await this.updateRefreshToken(user._id, tokens.refreshToken);
      return tokens;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException('Email already exists');
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async signIn(email: string, password: string) {
    const user = await this.usersService.findOne(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.getTokens(user._id, user.email);
    await this.updateRefreshToken(user._id, tokens.refreshToken);
    return tokens;
  }

  async refreshTokens(refreshToken: string) {
    try {
      // Decode the refresh token to get the userId
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const userId = decoded.sub;

      const user = await this.usersService.findById(userId);
      if (!user || !user.refreshToken)
        throw new ForbiddenException('Access Denied');
      const refreshTokenMatches = await bcrypt.compare(
        refreshToken,
        user.refreshToken
      );
      if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');
      const tokens = await this.getTokens(user._id, user.email);
      await this.updateRefreshToken(user._id, tokens.refreshToken);
      return tokens;
    } catch (error) {
      throw new ForbiddenException('Invalid refresh token');
    }
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async clearRefreshToken(userId: string) {
    await this.usersService.update(userId, { refreshToken: null });
  }

  async getUserIdFromRefreshToken(refreshToken: string) {
    const decoded = this.jwtService.verify(refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });
    return decoded.sub;
  }
}
