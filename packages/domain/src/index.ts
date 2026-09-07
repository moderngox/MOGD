/**
 * Domain package barrel. Each subdirectory is a boundary established in M0;
 * see docs/ARCHITECTURE.md §2 and docs/IMPLEMENTATION_PLAN.md for what lands
 * in each module and in which milestone. Do not add cross-module business
 * logic here — this file only proves the boundaries resolve.
 */
export * as users from "./users";
export * as assessment from "./assessment";
export * as physique from "./physique";
export * as training from "./training";
export * as nutrition from "./nutrition";
export * as exercises from "./exercises";
export * as programs from "./programs";
export * as progress from "./progress";
export * as checkins from "./checkins";
export * as adaptation from "./adaptation";
export * as safety from "./safety";
