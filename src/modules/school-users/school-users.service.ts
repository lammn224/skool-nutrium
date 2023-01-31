import { Injectable } from '@nestjs/common';
import { SchoolUser, SchoolUserDocument } from './school-user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  USER_NOT_EXIST,
  USER_NOT_EXIST_OR_DELETED,
  WRONG_USER_OR_PASSWORD,
} from '@/constants/error-codes.constant';
import { UserStatus } from './enum/user-status.enum';
import { throwNotFound } from '@/utils/exception.utils';
import { CreateSchoolUserDto } from './dto/create-school-user.dto';
import { Role } from '@/enums/role.enum';
import { CreateParentsDto } from '@/modules/school-users/dto/create-parents.dto';

@Injectable()
export class SchoolUsersService {
  constructor(
    @InjectModel(SchoolUser.name)
    private schoolUserModel: Model<SchoolUserDocument>,
  ) {}

  async createParents(createParentsDto: CreateParentsDto) {
    const isExistedParents = await this.schoolUserModel.findOne({
      phoneNumber: createParentsDto.phoneNumber,
    });
    if (isExistedParents) return isExistedParents;

    const newParents = await this.schoolUserModel.create({
      ...createParentsDto,
    });

    return newParents;
  }

  async createSchoolOwner(
    school: string,
    createSchoolUserDto: CreateSchoolUserDto,
  ): Promise<SchoolUser> {
    const owner = await this.schoolUserModel.create({
      school,
      ...createSchoolUserDto,
      role: Role.Admin,
    });

    return owner;
  }

  async findById(id: string): Promise<SchoolUser> {
    const schoolUser = await this.schoolUserModel.findOne({ _id: id });

    if (!schoolUser) {
      throwNotFound(USER_NOT_EXIST);
    }

    return schoolUser;
  }

  async attempt(phoneNumber, password, school) {
    const schoolUser = await this.schoolUserModel.findOne({
      school,
      phoneNumber,
    });

    let result = {
      status: USER_NOT_EXIST_OR_DELETED,
      canReturnToken: false,
      schoolUser: null,
    };

    if (schoolUser) {
      const matchPassword = await this.comparePassword(
        password,
        schoolUser.password,
      );

      if (matchPassword) {
        if (schoolUser.status === UserStatus.active) {
          result = {
            canReturnToken: true,
            schoolUser,
            status: schoolUser.status,
          };
        } else {
          result = {
            canReturnToken: false,
            schoolUser,
            status: schoolUser.status,
          };
        }
      } else {
        result = {
          canReturnToken: false,
          schoolUser,
          status: WRONG_USER_OR_PASSWORD,
        };
      }
    }

    return result;
  }

  async comparePassword(plainPass: string, password: string): Promise<boolean> {
    return await bcrypt.compare(plainPass, password);
  }

  async checkExist(
    key: string,
    value: string,
    userId = null,
  ): Promise<boolean> {
    const filter = {};
    filter[key] = value;
    if (userId) {
      filter['_id'] = { $ne: userId };
    }

    const user = await this.schoolUserModel.findOne(filter);

    return !!user;
  }

  async me(userId) {
    const user = await this.schoolUserModel
      .findOne({ _id: userId })
      .populate({
        path: 'school',
      })
      .populate({
        path: 'child',
        populate: 'class',
      });

    return user;
  }
}
