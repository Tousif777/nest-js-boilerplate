import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Res, Get, ConflictException, InternalServerErrorException, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SignUpDto } from './dto/sign-up.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body(new ValidationPipe()) signUpDto: SignUpDto, @Res({ passthrough: true }) response: Response) {
    try {
      const result = await this.authService.signUp(signUpDto.email, signUpDto.password, signUpDto.name);
      this.setRefreshTokenCookie(response, result.refreshToken);
      return {
        error: false,
        message: 'User signed up successfully',
        data: { accessToken: result.accessToken }
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException({ error: true, message: error.message });
      }
      throw new InternalServerErrorException({ error: true, message: 'Something went wrong' });
    }
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: { email: string; password: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.signIn(signInDto.email, signInDto.password);
    this.setRefreshTokenCookie(response, result.refreshToken);
    return {
      error: false,
      message: 'User signed in successfully',
      data: { accessToken: result.accessToken }
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);
      this.setRefreshTokenCookie(response, tokens.refreshToken);
      return {
        error: false,
        message: 'Tokens refreshed successfully',
        data: { accessToken: tokens.accessToken }
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  getMe(@Req() req: Request, @Res() res: Response) {
    const user = res.locals.user;

    if (user) {
      return res.json({
        error: false,
        message: 'User information retrieved successfully',
        data: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      });
    } else {
      return res.status(HttpStatus.NOT_FOUND).json({
        error: true,
        message: 'User information not found in res.locals'
      });
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      // Verify and decode the refresh token to get the user ID
      const userId = await this.authService.getUserIdFromRefreshToken(refreshToken);

      // Clear the refresh token in the database
      await this.authService.clearRefreshToken(userId);

      // Clear the refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        path: '/',
        ...this.getCookieOptions()
      });

      return {
        error: false,
        message: 'User logged out successfully'
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions: any = {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    };

    if (isProduction) {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'none';
    }

    response.cookie('refreshToken', refreshToken, cookieOptions);
  }

  private getCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions: any = {};

    if (isProduction) {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'none';
    }

    return cookieOptions;
  }
}
