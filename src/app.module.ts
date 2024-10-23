import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatsModule } from './cats/cats.module';
import { AuthMiddleware } from './auth/auth.middleware';
import * as fs from 'fs';
import * as path from 'path';

const moduleFiles = fs.readdirSync(__dirname).filter(file => 
  file.endsWith('.module.ts') && !['app.module.ts', 'auth.module.ts', 'users.module.ts', 'cats.module.ts'].includes(file)
);

const dynamicModules = moduleFiles.map(file => {
  const moduleName = path.parse(file).name.split('.')[0];
  return require(`./${moduleName}/${file}`)[`${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module`];
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // This makes the ConfigModule global
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CatsModule,
    ...dynamicModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*');
  }
}
