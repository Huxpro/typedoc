import { basename, dirname, parse, relative, resolve } from "path";
import { Deserializer, Serializer } from "../serialization";
import { MediaRegistry as JSONMediaRegistry } from "../serialization/schema";
import { normalizePath } from "../utils";
import { existsSync } from "fs";
import { Reflection } from "./reflections";

export class MediaRegistry {
    protected nextId = 1;

    // The combination of thest two make up the registry
    protected mediaToReflection = new Map<number, Reflection>();
    protected mediaToPath = new Map<number, string>();

    protected reflectionToPath = new Map<Reflection, string>();
    protected pathToMedia = new Map<string, number>();

    // Lazily created as we get names for rendering
    protected names = new Map<number, string>();
    protected nameUsage = new Map<string, number>();

    registerAbsolute(absolute: string) {
        absolute = normalizePath(absolute);
        const existing = this.pathToMedia.get(absolute);
        if (existing) {
            return existing;
        }

        this.mediaToPath.set(this.nextId, absolute);
        this.pathToMedia.set(absolute, this.nextId);

        return this.nextId++;
    }

    registerReflection(absolute: string, reflection: Reflection) {
        absolute = normalizePath(absolute);
        const id = this.registerAbsolute(absolute);
        this.reflectionToPath.set(reflection, absolute);
        this.mediaToReflection.set(id, reflection);
    }

    register(sourcePath: string, relativePath: string): number | undefined {
        return this.registerAbsolute(
            resolve(dirname(sourcePath), relativePath),
        );
    }

    removeReflection(reflection: Reflection): void {
        const absolute = this.reflectionToPath.get(reflection);
        if (absolute) {
            const media = this.pathToMedia.get(absolute)!;
            this.mediaToReflection.delete(media);
        }
    }

    resolve(id: number): string | Reflection | undefined {
        return this.mediaToReflection.get(id) ?? this.mediaToPath.get(id);
    }

    getName(id: number): string | undefined {
        const absolute = this.mediaToPath.get(id);
        if (!absolute) return;

        const file = basename(absolute);
        if (!this.nameUsage.has(file)) {
            this.nameUsage.set(file, 1);
            this.names.set(id, file);
        } else {
            const { name, ext } = parse(file);
            let counter = this.nameUsage.get(file)!;
            while (this.nameUsage.has(`${name}-${counter}${ext}`)) {
                ++counter;
            }
            this.nameUsage.set(file, counter + 1);
            this.nameUsage.set(`${name}-${counter}${ext}`, counter + 1);
            this.names.set(id, `${name}-${counter}${ext}`);
        }

        return this.names.get(id);
    }

    getNameToAbsoluteMap(): ReadonlyMap<string, string> {
        const result = new Map<string, string>();
        for (const [id, name] of this.names.entries()) {
            result.set(name, this.mediaToPath.get(id)!);
        }
        return result;
    }

    toObject(ser: Serializer): JSONMediaRegistry {
        const result: JSONMediaRegistry = {
            entries: {},
            reflections: {},
        };

        for (const [key, val] of this.mediaToPath.entries()) {
            result.entries[key] = relative(ser.projectRoot, val);
        }
        for (const [key, val] of this.mediaToReflection.entries()) {
            result.reflections[key] = val.id;
        }

        return result;
    }

    fromObject(de: Deserializer, obj: JSONMediaRegistry): void {
        for (const [key, val] of Object.entries(obj.entries)) {
            const absolute = normalizePath(resolve(de.projectRoot, val));
            const existingId = this.pathToMedia.get(absolute);
            if (existingId) return;

            de.oldMediaToNewMedia[+key] = this.nextId;
            this.mediaToPath.set(this.nextId, absolute);
            this.pathToMedia.set(absolute, this.nextId++);
        }

        de.defer((project) => {
            for (const [media, reflId] of Object.entries(obj.reflections)) {
                const refl = project.getReflectionById(
                    de.oldIdToNewId[reflId]!,
                );
                if (refl) {
                    this.mediaToReflection.set(
                        de.oldMediaToNewMedia[+media]!,
                        refl,
                    );
                }
            }
        });
    }
}

export class ValidatingMediaRegistry extends MediaRegistry {
    override register(
        sourcePath: string,
        relativePath: string,
    ): number | undefined {
        const absolute = resolve(dirname(sourcePath), relativePath);
        if (!existsSync(absolute)) {
            return;
        }
        return this.registerAbsolute(absolute);
    }

    override fromObject(de: Deserializer, obj: JSONMediaRegistry) {
        for (const [key, val] of Object.entries(obj.entries)) {
            const absolute = normalizePath(resolve(de.projectRoot, val));
            const existingId = this.pathToMedia.get(absolute);
            if (existingId) return;

            if (!existsSync(absolute)) {
                de.logger.warn(
                    de.logger.i18n.saved_relative_path_0_resolved_from_1_does_not_exist(
                        val,
                        de.projectRoot,
                    ),
                );
                continue;
            }

            de.oldMediaToNewMedia[+key] = this.nextId;
            this.mediaToPath.set(this.nextId, absolute);
            this.pathToMedia.set(absolute, this.nextId++);
        }

        de.defer((project) => {
            for (const [media, reflId] of Object.entries(obj.reflections)) {
                const refl = project.getReflectionById(
                    de.oldIdToNewId[reflId]!,
                );
                if (refl) {
                    this.mediaToReflection.set(
                        de.oldMediaToNewMedia[+media]!,
                        refl,
                    );
                }
            }
        });
    }
}
