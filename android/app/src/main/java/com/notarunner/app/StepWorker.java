package com.notarunner.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** The background reading of the step counter, every 15 minutes or so. */
public class StepWorker extends Worker {
    public StepWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        PhoneStepCounter.sample(getApplicationContext(), 5000);
        return Result.success();
    }
}
