import type { RbacUser } from '../rbac/rbac.types';
import { CreateLessonLearnedDto } from './dto/create-lesson-learned.dto';
import { CreateLessonLearnedTypeDto } from './dto/create-lesson-learned-type.dto';
import { ListLessonLearnedDto } from './dto/list-lesson-learned.dto';
import { UpdateLessonLearnedDto } from './dto/update-lesson-learned.dto';
import { UpdateLessonLearnedTypeDto } from './dto/update-lesson-learned-type.dto';
import { LessonsLearnedService } from './lessons-learned.service';
export declare class LessonsLearnedController {
    private readonly lessons;
    constructor(lessons: LessonsLearnedService);
    list(query: ListLessonLearnedDto, user: RbacUser): Promise<{
        items: ({
            type: {
                id: string;
                name: string;
                colorHex: string;
                textColorHex: string | null;
            };
            createdBy: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            createdById: string | null;
            content: string;
            authorLabel: string | null;
            typeId: string;
        })[];
    }>;
    listTypes(user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        }[];
    }>;
    create(dto: CreateLessonLearnedDto, user: RbacUser): Promise<{
        type: {
            id: string;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        };
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        content: string;
        authorLabel: string | null;
        typeId: string;
    }>;
    createType(dto: CreateLessonLearnedTypeDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        colorHex: string;
        textColorHex: string | null;
    }>;
    update(id: string, dto: UpdateLessonLearnedDto, user: RbacUser): Promise<{
        type: {
            id: string;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        };
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        content: string;
        authorLabel: string | null;
        typeId: string;
    }>;
    updateType(id: string, dto: UpdateLessonLearnedTypeDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        colorHex: string;
        textColorHex: string | null;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    removeType(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
